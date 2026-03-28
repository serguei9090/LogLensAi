import paramiko
from src.parser import DrainParser
from src.tailer import FileTailer


class SSHLoader(FileTailer):
    def __init__(self, host, port, username, password, filepath, workspace_id, parser: DrainParser):
        self.host = host
        self.port = port
        self.username = username
        self.password = password
        self.filepath = filepath
        self.workspace_id = workspace_id
        self.parser = parser
        self.running = False
        self.client = paramiko.SSHClient()
        self.client.set_missing_host_key_policy(paramiko.AutoAddPolicy())

    def _tail(self):
        try:
            self.client.connect(self.host, self.port, self.username, self.password)
            transport = self.client.get_transport()
            channel = transport.open_session()

            # Using tail -f
            import shlex

            quoted_path = shlex.quote(self.filepath)
            channel.exec_command(f"tail -n 0 -f {quoted_path}")

            while self.running:
                if channel.recv_ready():
                    data = channel.recv(1024)
                    for line in data.decode("utf-8").splitlines():
                        self._process_line(line.strip())
                else:
                    import time

                    time.sleep(0.1)

        except Exception:
            self.running = False

    def stop(self):
        self.running = False
        if hasattr(self, "thread") and self.thread:
            self.thread.join(timeout=2)
        if self.client:
            self.client.close()
