import os
import json
import csv
import pytest
from api import App
from models import ExportLogsRequest

@pytest.mark.asyncio
async def test_export_logs_csv(tmp_path):
    from db import LogDatabase
    LogDatabase.reset()
    app = App(db_path=":memory:")
    # Seed some data
    app.db.get_cursor().execute(
        "INSERT INTO logs (workspace_id, timestamp, level, message) VALUES (?, ?, ?, ?)",
        ("ws1", "2024-01-01 10:00:00", "INFO", "Hello World")
    )
    
    export_path = str(tmp_path / "export.csv")
    req = ExportLogsRequest(workspace_id="ws1", filepath=export_path, format="csv")
    
    await app.method_export_logs(**req.model_dump())
    
    assert os.path.exists(export_path)
    with open(export_path, "r", newline="") as f:
        reader = csv.DictReader(f)
        rows = list(reader)
        assert len(rows) == 1
        assert rows[0]["message"] == "Hello World"

@pytest.mark.asyncio
async def test_export_logs_json(tmp_path):
    from db import LogDatabase
    LogDatabase.reset()
    app = App(db_path=":memory:")
    app.db.get_cursor().execute(
        "INSERT INTO logs (workspace_id, timestamp, level, message) VALUES (?, ?, ?, ?)",
        ("ws1", "2024-01-01 10:00:00", "INFO", "Hello World")
    )
    
    export_path = str(tmp_path / "export.json")
    req = ExportLogsRequest(workspace_id="ws1", filepath=export_path, format="json")
    
    await app.method_export_logs(**req.model_dump())
    
    assert os.path.exists(export_path)
    with open(export_path, "r") as f:
        data = json.load(f)
        assert len(data) == 1
        assert data[0]["message"] == "Hello World"
