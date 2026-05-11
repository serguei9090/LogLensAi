import logging
import os
import sys

# Setup paths
SIDE_CAR_DIR = os.path.join(os.getcwd(), "sidecar", "src")
sys.path.append(SIDE_CAR_DIR)

from api import App  # noqa: E402
from models import GetLogsRequest  # noqa: E402

# Setup logging to stdout for scratch script
logging.basicConfig(level=logging.INFO, stream=sys.stdout)


def test_hydration():
    # Use a temporary DB for testing
    test_db = os.path.join(os.getcwd(), "data", "test.duckdb")
    if os.path.exists(test_db):
        os.remove(test_db)

    app = App(db_path=test_db, start_ingestion=False, start_anomalies=False, start_mcp=False)

    workspace_id = "test_ws"
    source_id = "test_src"
    from models import IngestLogEntry, IngestLogsRequest

    logs_to_ingest = [
        IngestLogEntry(
            workspace_id=workspace_id,
            source_id=source_id,
            raw_text="First log line",
            timestamp="2024-01-01 10:00:01",
            level="INFO",
            message="First log line",
        ),
        IngestLogEntry(
            workspace_id=workspace_id,
            source_id=source_id,
            raw_text="Second log line with error",
            timestamp="2024-01-01 10:00:02",
            level="ERROR",
            message="Second log line with error",
        ),
        IngestLogEntry(
            workspace_id=workspace_id,
            source_id=source_id,
            raw_text="Third log line for debug",
            timestamp="2024-01-01 10:00:03",
            level="DEBUG",
            message="Third log line for debug",
        ),
    ]

    IngestLogsRequest(logs=logs_to_ingest)
    app.method_ingest_logs(logs=logs_to_ingest)

    # 2. Fetch logs
    fetch_params = GetLogsRequest(workspace_id=workspace_id, limit=10, offset=0)

    result = app.method_get_logs(fetch_params)

    print("\n--- INGESTED LOGS VERIFICATION ---")
    print(f"Total logs: {result['total']}")
    for log in result["logs"]:
        print(
            f"ID: {log['id']}, Line ID: {log['line_id']}, Level: {log['level']}, Message: '{log['message']}'"
        )
        if not log["message"] or log["message"] == "<Missing log content>":
            print("❌ ERROR: Message is empty or missing!")
        elif log["message"] in [entry["message"] for entry in logs_to_ingest]:
            print("✅ SUCCESS: Message matches ingested content.")
        else:
            print(f"❌ ERROR: Message mismatch! Got '{log['message']}'")


if __name__ == "__main__":
    test_hydration()
