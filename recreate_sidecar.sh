#!/bin/bash
mkdir -p sidecar/src sidecar/tests

cat << 'PROJ' > sidecar/pyproject.toml
[project]
name = "loglensai-sidecar"
version = "0.1.0"
description = "LogLensAi Python Sidecar"
authors = [{name = "Jules"}]
dependencies = [
    "duckdb>=1.2.0",
    "drain3>=0.9.11",
    "aiohttp>=3.11.0",
    "aiohttp-cors>=0.7.0",
    "paramiko>=3.5.0",
    "pydantic>=2.10.0",
]
requires-python = ">=3.12"

[tool.uv]
managed = true

[build-system]
requires = ["hatchling"]
build-backend = "hatchling.build"

[tool.pytest.ini_options]
asyncio_mode = "auto"
asyncio_default_fixture_loop_scope = "function"

[tool.hatch.build.targets.wheel]
packages = ["src"]
PROJ

cat << 'DB' > sidecar/src/db.py
import duckdb
import os
import threading

class Database:
    _instance = None
    _lock = threading.Lock()
    
    def __new__(cls, db_path="loglens.duckdb"):
        with cls._lock:
            if cls._instance is None:
                cls._instance = super(Database, cls).__new__(cls)
                cls._instance._init_db(db_path)
        return cls._instance
        
    def _init_db(self, db_path):
        # Memory mode is allowed for tests, else absolute path
        if db_path != ":memory:":
            db_path = os.path.abspath(db_path)
            
        self.conn = duckdb.connect(db_path)
        self._create_tables()
        
    def _create_tables(self):
        cursor = self.get_cursor()
        cursor.execute("""
            CREATE TABLE IF NOT EXISTS logs (
                id INTEGER PRIMARY KEY,
                workspace_id TEXT,
                timestamp TEXT,
                level TEXT,
                message TEXT,
                cluster_id TEXT,
                raw_text TEXT,
                has_comment BOOLEAN DEFAULT FALSE,
                comment TEXT
            );
            
            CREATE SEQUENCE IF NOT EXISTS log_id_seq;
            
            CREATE TABLE IF NOT EXISTS settings (
                key TEXT PRIMARY KEY,
                value TEXT
            );
        """)
        
    def get_cursor(self):
        # BUG-001 Fix: Use thread-local cursor
        return self.conn.cursor()
        
    @classmethod
    def reset(cls):
        with cls._lock:
            if cls._instance is not None:
                if hasattr(cls._instance, 'conn'):
                    cls._instance.conn.close()
                cls._instance = None
DB

cat << 'PARSER' > sidecar/src/parser.py
from drain3 import TemplateMiner
from drain3.template_miner_config import TemplateMinerConfig

class DrainParser:
    def __init__(self, sim_th=0.4, max_children=100, max_clusters=1000):
        self.config = TemplateMinerConfig()
        self.config.drain_sim_th = sim_th
        self.config.drain_max_children = max_children
        self.config.drain_max_clusters = max_clusters
        self.miner = TemplateMiner(config=self.config)

    def parse(self, log_line: str) -> str:
        result = self.miner.add_log_message(log_line)
        return result["cluster_id"]
        
    def get_clusters(self):
        return self.miner.drain.clusters
PARSER

cat << 'TAILER' > sidecar/src/tailer.py
import os
import time
import threading
from src.db import Database
from src.parser import DrainParser

class FileTailer:
    def __init__(self, filepath, workspace_id, parser: DrainParser):
        self.filepath = os.path.abspath(filepath)
        self.workspace_id = workspace_id
        self.parser = parser
        self.running = False
        self.thread = None
        self.db = Database()

    def start(self):
        if self.running:
            return
        self.running = True
        self.thread = threading.Thread(target=self._tail, daemon=True)
        self.thread.start()

    def stop(self):
        self.running = False
        if self.thread:
            self.thread.join(timeout=2)

    def _tail(self):
        try:
            with open(self.filepath, 'r') as f:
                # Seek to end for live tailing
                f.seek(0, 2)
                
                while self.running:
                    line = f.readline()
                    if not line:
                        time.sleep(0.1)
                        continue
                        
                    self._process_line(line.strip())
        except FileNotFoundError:
            self.running = False

    def _process_line(self, line: str):
        if not line:
            return
            
        cluster_id = str(self.parser.parse(line))
        
        # Simple heuristic for level extraction, usually this would be more robust
        level = "INFO"
        upper_line = line.upper()
        for lvl in ["ERROR", "WARN", "DEBUG", "TRACE", "INFO"]:
            if lvl in upper_line:
                level = lvl
                break
                
        # Timestamp placeholder (e.g. current time if missing)
        import datetime
        timestamp = datetime.datetime.now().strftime("%Y-%m-%d %H:%M:%S")

        cursor = self.db.get_cursor()
        cursor.execute("""
            INSERT INTO logs (id, workspace_id, timestamp, level, message, cluster_id, raw_text)
            VALUES (nextval('log_id_seq'), ?, ?, ?, ?, ?, ?)
        """, (self.workspace_id, timestamp, level, line, cluster_id, line))
TAILER

cat << 'SSH' > sidecar/src/ssh_loader.py
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
        if hasattr(self, 'thread') and self.thread:
            self.thread.join(timeout=2)
        if self.client:
            self.client.close()
SSH

cat << 'AI' > sidecar/src/ai.py
import json
import subprocess
from pydantic import BaseModel, ValidationError

class DiagnosticResult(BaseModel):
    summary: str
    root_cause: str
    recommended_actions: list[str]

class AIProvider:
    def __init__(self, provider="gemini-cli", api_key="", system_prompt=""):
        self.provider = provider
        self.api_key = api_key
        self.system_prompt = system_prompt or "You are a Log Analysis Specialist. Return JSON with summary, root_cause, actions."

    def analyze(self, cluster_template: str, samples: list[str]) -> dict:
        if self.provider != "gemini-cli":
            return {
                "summary": "Analysis failed", 
                "root_cause": f"Unsupported provider: {self.provider}", 
                "recommended_actions": []
            }
            
        prompt = f"{self.system_prompt}\n\nCluster template: {cluster_template}\nSample logs:\n" + "\n".join(samples)
        
        try:
            result = subprocess.run(
                ["gemini", "-p", prompt, "--json"], 
                capture_output=True, 
                text=True, 
                timeout=30
            )
            
            if result.returncode != 0:
                raise RuntimeError(result.stderr)
                
            parsed = json.loads(result.stdout)
            validated = DiagnosticResult(**parsed)
            return validated.model_dump()
            
        except subprocess.TimeoutExpired:
            return {"summary": "Analysis failed", "root_cause": "Timeout", "recommended_actions": []}
        except (json.JSONDecodeError, ValidationError) as e:
            return {"summary": "Analysis failed", "root_cause": str(e), "recommended_actions": []}
        except Exception as e:
            return {"summary": "Analysis failed", "root_cause": str(e), "recommended_actions": []}
AI

cat << 'API' > sidecar/src/api.py
import sys
import json
import os
from aiohttp import web
from pydantic import BaseModel, ValidationError
from typing import Optional, Any

from src.db import Database
from src.parser import DrainParser
from src.tailer import FileTailer
from src.ai import AIProvider

# RPC Models
class JSONRPCRequest(BaseModel):
    jsonrpc: str = "2.0"
    id: Optional[Any] = None
    method: str
    params: dict = {}

class JSONRPCResponse(BaseModel):
    jsonrpc: str = "2.0"
    id: Optional[Any] = None
    result: Optional[Any] = None
    error: Optional[dict] = None

class App:
    def __init__(self, db_path="loglens.duckdb"):
        self.db = Database(db_path)
        self.parser = DrainParser()
        self.tailers = {}
        self.ai = AIProvider()
        self.dev_mode = False

    def dispatch(self, req: JSONRPCRequest) -> JSONRPCResponse:
        try:
            method_name = f"method_{req.method}"
            if not hasattr(self, method_name):
                return JSONRPCResponse(id=req.id, error={"code": -32601, "message": "Method not found"})

            method = getattr(self, method_name)
            result = method(**req.params)
            return JSONRPCResponse(id=req.id, result=result)
        except Exception as e:
            if self.dev_mode:
                import traceback
                error_msg = traceback.format_exc()
            else:
                error_msg = str(e)
            return JSONRPCResponse(
                id=req.id, 
                error={"code": -32603, "message": "Internal error", "data": error_msg}
            )

    def method_get_logs(self, workspace_id: str, offset: int = 0, limit: int = 50, level: str = None, query: str = None, source_id: str = None) -> dict:
        cursor = self.db.get_cursor()
        
        base_query = "SELECT * FROM logs WHERE workspace_id = ?"
        params = [workspace_id]
        
        if level:
            base_query += " AND level = ?"
            params.append(level)
            
        if query:
            base_query += " AND message LIKE ?"
            params.append(f"%{query}%")
            
        if source_id:
            base_query += " AND source_id = ?"
            params.append(source_id)

        count_query = f"SELECT COUNT(*) FROM ({base_query})"
        cursor.execute(count_query, params)
        total = cursor.fetchone()[0]
        
        data_query = base_query + " ORDER BY id DESC LIMIT ? OFFSET ?"
        params.extend([limit, offset])
        cursor.execute(data_query, params)
        
        columns = [desc[0] for desc in cursor.description]
        logs = [dict(zip(columns, row, strict=False)) for row in cursor.fetchall()]

        return {"total": total, "logs": logs, "offset": offset, "limit": limit}

    def method_start_tail(self, filepath: str, workspace_id: str) -> dict:
        abs_path = os.path.abspath(filepath)
        key = f"{workspace_id}:{abs_path}"

        if key in self.tailers and self.tailers[key].running:
            return {"status": "already tailing"}

        tailer = FileTailer(abs_path, workspace_id, self.parser)
        self.tailers[key] = tailer
        tailer.start()
        
        return {"status": "started"}

    def method_stop_tail(self, filepath: str, workspace_id: str) -> dict:
        abs_path = os.path.abspath(filepath)
        key = f"{workspace_id}:{abs_path}"
        
        if key in self.tailers:
            self.tailers[key].stop()
            del self.tailers[key]
            return {"status": "stopped"}
            
        return {"status": "not found"}

    def method_is_tailing(self, filepath: str, workspace_id: str) -> bool:
        abs_path = os.path.abspath(filepath)
        key = f"{workspace_id}:{abs_path}"
        return key in self.tailers and self.tailers[key].running

    def method_get_clusters(self, workspace_id: str) -> list:
        clusters = self.parser.get_clusters()
        return [{"id": c.cluster_id, "template": c.get_template(), "size": c.size} for c in clusters]

    def method_analyze_cluster(self, cluster_id: str, workspace_id: str) -> dict:
        cursor = self.db.get_cursor()
        
        cursor.execute(
            "SELECT raw_text FROM logs WHERE workspace_id = ? AND cluster_id = ? LIMIT 20", 
            (workspace_id, cluster_id)
        )
        samples = [row[0] for row in cursor.fetchall()]
        
        clusters = self.parser.get_clusters()
        template = ""
        for c in clusters:
            if str(c.cluster_id) == str(cluster_id):
                template = c.get_template()
                break
                
        return self.ai.analyze(template, samples)
        
    def method_get_settings(self) -> dict:
        cursor = self.db.get_cursor()
        cursor.execute("SELECT key, value FROM settings")
        return {row[0]: row[1] for row in cursor.fetchall()}
        
    def method_update_settings(self, settings: dict) -> dict:
        cursor = self.db.get_cursor()
        
        if "ai_provider" in settings:
            self.ai.provider = settings["ai_provider"]
        if "ai_api_key" in settings:
            self.ai.api_key = settings["ai_api_key"]
        if "ai_system_prompt" in settings:
            self.ai.system_prompt = settings["ai_system_prompt"]

        for k, v in settings.items():
            cursor.execute(
                "INSERT INTO settings (key, value) VALUES (?, ?) ON CONFLICT (key) DO UPDATE SET value = excluded.value", 
                (k, str(v))
            )
            
        return {"status": "success"}

    async def aiohttp_handler(self, request):
        try:
            body = await request.json()
            req = JSONRPCRequest(**body)
            res = self.dispatch(req)
            return web.json_response(res.model_dump())
        except ValidationError:
            return web.json_response(
                {"jsonrpc": "2.0", "id": None, "error": {"code": -32600, "message": "Invalid Request"}}, 
                status=400
            )
        except Exception:
            return web.json_response(
                {"jsonrpc": "2.0", "id": None, "error": {"code": -32603, "message": "Internal error"}}, 
                status=500
            )

async def on_cleanup(app):
    Database.reset()

def run_http(port=5000):
    app = App()
    app.dev_mode = True
    server = web.Application()
    server.add_routes([web.post('/rpc', app.aiohttp_handler)])
    server.on_cleanup.append(on_cleanup)
    web.run_app(server, port=port)

def run_stdio():
    app = App()
    app.dev_mode = False
    
    try:
        for line in sys.stdin:
            if not line.strip():
                continue
            try:
                req_dict = json.loads(line)
                req = JSONRPCRequest(**req_dict)
                res = app.dispatch(req)
                print(json.dumps(res.model_dump()), flush=True)
            except json.JSONDecodeError:
                print(
                    json.dumps({"jsonrpc": "2.0", "id": None, "error": {"code": -32700, "message": "Parse error"}}), 
                    flush=True
                )
            except ValidationError:
                id_val = req_dict.get("id") if isinstance(req_dict, dict) else None
                print(
                    json.dumps({"jsonrpc": "2.0", "id": id_val, "error": {"code": -32600, "message": "Invalid Request"}}), 
                    flush=True
                )
    except KeyboardInterrupt:
        pass
    except EOFError:
        pass
    finally:
        Database.reset()

def main():
    if "--dev" in sys.argv:
        run_http(5000)
    else:
        run_stdio()

if __name__ == "__main__":
    main()
API

cat << 'MAIN' > sidecar/main.py
import sys
from src.api import main

if __name__ == "__main__":
    main()
MAIN

cat << 'CONF' > sidecar/tests/conftest.py
import sys
import os
sys.path.insert(0, os.path.abspath(os.path.join(os.path.dirname(__file__), '..')))
CONF

cat << 'TESTAPI' > sidecar/tests/test_api.py
import pytest
from src.api import App, JSONRPCRequest

@pytest.fixture
def api():
    app = App(db_path=":memory:")
    yield app
    from src.db import Database
    Database.reset()

def test_json_rpc_dispatch(api):
    req = JSONRPCRequest(
        id=1,
        method="get_logs",
        params={"workspace_id": "test_ws", "limit": 10}
    )
    res = api.dispatch(req)
    
    assert res.jsonrpc == "2.0"
    assert res.id == 1
    assert res.error is None
    assert "logs" in res.result
    assert res.result["total"] == 0

def test_invalid_method(api):
    req = JSONRPCRequest(
        id=2,
        method="non_existent",
        params={}
    )
    res = api.dispatch(req)
    
    assert res.error is not None
    assert res.error["code"] == -32601
TESTAPI

cat << 'TESTE2E' > sidecar/tests/test_e2e_ingestion.py
import pytest
import tempfile
import time
import os
from src.api import App, JSONRPCRequest
from src.db import Database

@pytest.fixture
def mock_log_file():
    with tempfile.NamedTemporaryFile(mode='w', delete=False, suffix=".log") as f:
        f.write("2023-10-01 10:00:00 [INFO] Server started\n")
        f.write("2023-10-01 10:00:05 [ERROR] Connection failed timeout\n")
        f.flush()
        yield f.name
    os.remove(f.name)

@pytest.fixture
def e2e_api():
    app = App(db_path=":memory:")
    yield app
    Database.reset()

def test_start_tail_and_get_logs(e2e_api, mock_log_file):
    req_start = JSONRPCRequest(
        id=1,
        method="start_tail",
        params={"filepath": mock_log_file, "workspace_id": "test_e2e_ws"}
    )
    res_start = e2e_api.dispatch(req_start)
    assert res_start.result["status"] == "started"

    # Wait for tailer thread to process lines
    time.sleep(1)

    req_logs = JSONRPCRequest(
        id=2,
        method="get_logs",
        params={"workspace_id": "test_e2e_ws"}
    )
    res_logs = e2e_api.dispatch(req_logs)

    # Note: FileTailer reads from EOF because it's a "tail". 
    # Let's append a log line to test actual ingestion.
    with open(mock_log_file, 'a') as f:
        f.write("2023-10-01 10:00:10 [DEBUG] New log entry\n")
        f.flush()
        
    time.sleep(1)
    
    res_logs_after = e2e_api.dispatch(req_logs)
    
    assert res_logs_after.result["total"] >= 1
    assert any("New log entry" in log["message"] for log in res_logs_after.result["logs"])
    
    # Cleanup
    req_stop = JSONRPCRequest(
        id=3,
        method="stop_tail",
        params={"filepath": mock_log_file, "workspace_id": "test_e2e_ws"}
    )
    e2e_api.dispatch(req_stop)
TESTE2E
