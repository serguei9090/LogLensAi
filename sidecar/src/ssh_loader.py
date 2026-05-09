import logging
import shlex
import threading
import time

import paramiko
from services.shared_core import SharedSourceManager

logger = logging.getLogger("SSHLoader")


class SSHLoader:
    """
    Ingestor that tails a remote file over SSH and pushes lines to a SharedSource.
    """

    def __init__(
        self,
        host,
        port,
        username,
        password,
        filepath,
        log_store,
        source_id: str,
    ):
        self.host = host
        self.port = port
        self.username = username
        self.password = password
        self.filepath = filepath
        self.source_id = source_id

        self._manager = SharedSourceManager(log_store)
        self.client = paramiko.SSHClient()
        self.client.set_missing_host_key_policy(paramiko.AutoAddPolicy())

        self.running = False
        self.thread = None

    def start(self):
        if self.running:
            return
        self.running = True
        self.thread = threading.Thread(
            target=self._tail_loop, name=f"SSHTailer-{self.source_id}", daemon=True
        )
        self.thread.start()

    def _tail_loop(self):
        try:
            self.client.connect(self.host, self.port, self.username, self.password)
            transport = self.client.get_transport()
            if not transport:
                logger.error("[SSH] Failed to get transport for %s", self.host)
                return

            channel = transport.open_session()
            quoted_path = shlex.quote(self.filepath)
            channel.exec_command(f"tail -n 0 -f {quoted_path}")

            shared_src = self._manager.get_source(self.source_id)

            while self.running:
                if channel.recv_ready():
                    data = channel.recv(4096)
                    for line in data.decode("utf-8", errors="ignore").splitlines():
                        shared_src.push_line(line.strip())
                else:
                    time.sleep(0.1)

        except Exception as e:
            logger.error("[SSH] Tail loop error for %s: %s", self.host, e)
            self.running = False
        finally:
            self.client.close()

    def stop(self):
        self.running = False
        if self.thread:
            self.thread.join(timeout=2)
        if self.client:
            self.client.close()
