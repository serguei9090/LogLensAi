import contextlib
import logging
import socket
import threading
from datetime import datetime

from aiohttp import web

logger = logging.getLogger("LogLensIngestion")


class IngestionServer:
    """
    Background server that listens for incoming logs via Syslog (UDP) and HTTP (TCP).
    """

    def __init__(
        self, app, syslog_port=514, http_port=5001, syslog_enabled=True, http_enabled=True
    ):
        self.app = app
        self.syslog_port = syslog_port
        self.http_port = http_port
        self.syslog_enabled = syslog_enabled
        self.http_enabled = http_enabled
        self.running = False
        self._stop_event = threading.Event()
        self._threads = []
        self._http_runner = None
        self._http_loop = None
        self._streams_cache = []  # List of dicts: {workspace_id, name, type, port}

    def start(self):
        if self.running:
            return
        self.running = True
        self._stop_event.clear()
        self._threads = []
        self.refresh_streams()

        if self.syslog_enabled:
            syslog_thread = threading.Thread(
                target=self._run_syslog, name="IngestionSyslog", daemon=True
            )
            syslog_thread.start()
            self._threads.append(syslog_thread)
            logger.info(
                "Ingestion Server: Syslog UDP listener started on port %s", self.syslog_port
            )

        if self.http_enabled:
            http_thread = threading.Thread(target=self._run_http, name="IngestionHTTP", daemon=True)
            http_thread.start()
            self._threads.append(http_thread)
            logger.info("Ingestion Server: HTTP TCP listener started on port %s", self.http_port)

    def stop(self):
        self.running = False
        self._stop_event.set()

        if self._http_loop and self._http_loop.is_running():
            try:
                self._http_loop.call_soon_threadsafe(self._http_loop.stop)
            except Exception as e:
                logger.error("Error signaling HTTP loop stop: %s", e)

        # Give threads a moment to die
        for t in self._threads:
            if t.is_alive():
                t.join(timeout=1.0)

        self._threads = []
        logger.info("Ingestion Server: Stopped")

    def reconfigure(self, syslog_enabled, syslog_port, http_enabled, http_port):
        """Dynamic restart if settings changed"""
        changed = (
            self.syslog_enabled != syslog_enabled
            or self.syslog_port != syslog_port
            or self.http_enabled != http_enabled
            or self.http_port != http_port
        )
        if not changed and self.running:
            return

        logger.info("Ingestion Server: Reconfiguring listeners...")
        self.stop()
        # Small sleep to ensure OS releases ports
        import time

        time.sleep(0.2)

        self.syslog_enabled = syslog_enabled
        self.syslog_port = syslog_port
        self.http_enabled = http_enabled
        self.http_port = http_port
        self.start()

    def refresh_streams(self):
        """Fetch all active routing rules from the DB."""
        try:
            cursor = self.app.db.get_cursor()
            cursor.execute(
                "SELECT workspace_id, name, type, port FROM log_streams WHERE enabled = 1"
            )
            self._streams_cache = [
                {"workspace_id": r[0], "name": r[1], "type": r[2], "port": r[3]}
                for r in cursor.fetchall()
            ]
            logger.info(f"Ingestion Server: Refreshed {len(self._streams_cache)} log streams")
        except Exception as e:
            logger.error(f"Failed to refresh log streams: {e}")

    def _run_syslog(self):
        sock = socket.socket(socket.AF_INET, socket.SOCK_DGRAM)
        try:
            sock.setsockopt(socket.SOL_SOCKET, socket.SO_REUSEADDR, 1)
            sock.bind(("0.0.0.0", self.syslog_port))
            sock.settimeout(1.0)
        except Exception as e:
            logger.error(f"Failed to bind Syslog port {self.syslog_port}: {e}")
            return

        while not self._stop_event.is_set() and self.running:
            try:
                data, addr = sock.recvfrom(4096)
                raw_text = data.decode("utf-8", errors="ignore").strip()
                if not raw_text:
                    continue

                # Routing logic
                target_streams = [
                    s
                    for s in self._streams_cache
                    if s["type"] == "syslog" and s["port"] == self.syslog_port
                ]

                if not target_streams:
                    # Fallback to default
                    target_streams = [{"workspace_id": "default", "name": "syslog"}]

                for stream in target_streams:
                    log_entry = {
                        "workspace_id": stream["workspace_id"],
                        "source_id": stream["name"],
                        "raw_text": raw_text,
                        "timestamp": datetime.now().strftime("%Y-%m-%d %H:%M:%S"),
                        "level": "INFO",
                        "facets": {"source_ip": addr[0]},
                    }
                    try:
                        self.app.method_ingest_logs([log_entry])
                    except Exception as ingest_err:
                        logger.error(
                            "Syslog ingestion processing error (WS: %s): %s",
                            stream["workspace_id"],
                            ingest_err,
                        )
            except TimeoutError:
                continue
            except Exception as e:
                if not self._stop_event.is_set():
                    logger.error("Syslog ingestion network error: %s", e)

        sock.close()

    def _run_http(self):
        import asyncio

        # Create a fresh loop for this thread
        self._http_loop = asyncio.new_event_loop()
        asyncio.set_event_loop(self._http_loop)

        async def handle_ingest(request):
            try:
                # Identification: URL path > Query Param > Default
                workspace_id = (
                    request.match_info.get("workspace_id") or request.query.get("ws") or "default"
                )

                # Source/Collection extraction: Path > Query > Default
                source_id = (
                    request.match_info.get("collection_name")
                    or request.query.get("source_id")
                    or "http-ingest"
                )

                data = await request.json()
                if isinstance(data, dict):
                    logs = [data]
                elif isinstance(data, list):
                    logs = data
                else:
                    return web.Response(status=400, text="Invalid JSON format")

                # Routing logic for HTTP
                if workspace_id == "default":
                    target_streams = [
                        s
                        for s in self._streams_cache
                        if s["type"] == "http" and s["port"] == self.http_port
                    ]
                    if not target_streams:
                        target_streams = [{"workspace_id": "default", "name": source_id}]
                else:
                    # Explicit workspace in URL takes precedence
                    target_streams = [{"workspace_id": workspace_id, "name": source_id}]

                for stream in target_streams:
                    # Create a deep copy for each workspace to avoid side effects
                    workspace_logs = []
                    for log in logs:
                        entry = log.copy()
                        entry["workspace_id"] = stream["workspace_id"]

                        # Use the specific collection name if provided in routing, else fallback to stream name
                        entry["source_id"] = (
                            source_id if workspace_id != "default" else stream["name"]
                        )

                        if "raw_text" not in entry and "message" in entry:
                            entry["raw_text"] = entry["message"]
                        workspace_logs.append(entry)

                    try:
                        self.app.method_ingest_logs(workspace_logs)
                    except Exception as ingest_err:
                        logger.error(
                            f"HTTP ingestion processing error (WS: {stream['workspace_id']}): {ingest_err}"
                        )

                return web.json_response({"status": "ok", "count": len(logs)})
            except Exception as e:
                return web.Response(status=500, text=str(e))

        app = web.Application()
        app.router.add_post("/ingest", handle_ingest)
        app.router.add_post("/ingest/{workspace_id}", handle_ingest)
        app.router.add_post("/ingest/{workspace_id}/{collection_name}", handle_ingest)
        app.router.add_post("/", handle_ingest)

        runner = web.AppRunner(app)
        self._http_loop.run_until_complete(runner.setup())
        site = web.TCPSite(runner, "0.0.0.0", self.http_port)

        try:
            self._http_loop.run_until_complete(site.start())
            self._http_runner = runner
        except Exception as e:
            logger.error("Failed to start TCPSite on %s: %s", self.http_port, e)
            self._http_loop.run_until_complete(runner.cleanup())
            return

        try:
            self._http_loop.run_forever()
        except Exception as e:
            logger.error("HTTP ingestion loop error: %s", e)
        finally:
            logger.info("Cleaning up HTTP ingestion loop...")
            with contextlib.suppress(Exception):
                self._http_loop.run_until_complete(runner.cleanup())
            self._http_loop.close()
