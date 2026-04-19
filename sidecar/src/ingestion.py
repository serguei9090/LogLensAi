import json
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

    def __init__(self, app, syslog_port=514, http_port=5001):
        self.app = app
        self.syslog_port = syslog_port
        self.http_port = http_port
        self.running = False
        self._threads = []
        self._http_runner = None

    def start(self):
        self.running = True
        
        # Start Syslog UDP Listener
        syslog_thread = threading.Thread(target=self._run_syslog, daemon=True)
        syslog_thread.start()
        self._threads.append(syslog_thread)
        
        # Start HTTP TCP Listener (Port 5001)
        http_thread = threading.Thread(target=self._run_http, daemon=True)
        http_thread.start()
        self._threads.append(http_thread)
        
        logger.info(f"Ingestion Server: Syslog UDP listener started on port {self.syslog_port}")
        logger.info(f"Ingestion Server: HTTP TCP listener started on port {self.http_port}")

    def stop(self):
        self.running = False
        if self._http_runner:
            # We can't easily stop it from another thread without async loop access,
            # but since it's a daemon thread, it will die with the process.
            pass

    def _run_syslog(self):
        sock = socket.socket(socket.AF_INET, socket.SOCK_DGRAM)
        try:
            sock.bind(("0.0.0.0", self.syslog_port))
            sock.settimeout(1.0)
        except Exception as e:
            logger.error(f"Failed to bind Syslog port {self.syslog_port}: {e}")
            return

        while self.running:
            try:
                data, addr = sock.recvfrom(4096)
                raw_text = data.decode("utf-8", errors="ignore").strip()
                if not raw_text:
                    continue

                log_entry = {
                    "workspace_id": "default",
                    "source_id": f"syslog://{addr[0]}",
                    "raw_text": raw_text,
                    "timestamp": datetime.now().strftime("%Y-%m-%d %H:%M:%S"),
                    "level": "INFO"
                }
                self.app.method_ingest_logs([log_entry])
            except socket.timeout:
                continue
            except Exception as e:
                logger.error(f"Syslog ingestion error: {e}")

    def _run_http(self):
        import asyncio
        loop = asyncio.new_event_loop()
        asyncio.set_event_loop(loop)

        async def handle_ingest(request):
            try:
                data = await request.json()
                if isinstance(data, dict):
                    logs = [data]
                elif isinstance(data, list):
                    logs = data
                else:
                    return web.Response(status=400, text="Invalid JSON format")
                
                # Ensure workspace_id is set if missing
                for l in logs:
                    if "workspace_id" not in l:
                        l["workspace_id"] = "default"
                    if "source_id" not in l:
                        l["source_id"] = "http-ingest"
                    if "raw_text" not in l and "message" in l:
                        l["raw_text"] = l["message"]

                self.app.method_ingest_logs(logs)
                return web.json_response({"status": "ok", "count": len(logs)})
            except Exception as e:
                return web.Response(status=500, text=str(e))

        app = web.Application()
        app.router.add_post("/ingest", handle_ingest)
        
        # Also support root for simple pings/webhooks
        app.router.add_post("/", handle_ingest)

        runner = web.AppRunner(app)
        loop.run_until_complete(runner.setup())
        site = web.TCPSite(runner, "0.0.0.0", self.http_port)
        loop.run_until_complete(site.start())
        self._http_runner = runner
        
        try:
            loop.run_forever()
        except Exception:
            pass
        finally:
            loop.close()
