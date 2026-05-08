import sys
import os
import json
import logging

# Set up basic logging to see our trace messages
logging.basicConfig(level=logging.INFO)

# Add sidecar/src to sys.path
PROJECT_ROOT = "i:/01-Master_Code/Apps/LogLensAi"
SIDECAR_SRC = os.path.join(PROJECT_ROOT, "sidecar", "src")
sys.path.append(SIDECAR_SRC)

# Mock some environment variables if needed
os.environ["PROJECT_ROOT"] = PROJECT_ROOT

from api import App
from models import IngestLogEntry

def test_hydration():
    print("--- Starting Hydration Verification ---")
    
    # Initialize App
    # We use a test DB to avoid messing with production
    test_db = "data/test_hydration.duckdb"
    app = App(db_path=test_db, start_ingestion=False, start_anomalies=False)
    
    workspace_id = "test_ws_123"
    source_id = "test_src_456"
    
    # Clean up any existing logs for this source in DB
    with app.db.get_cursor() as cur:
        cur.execute("DELETE FROM logs WHERE workspace_id = ?", (workspace_id,))
    
    # Ingest a sample log
    raw_content = "2024-05-08 14:00:00 [DEBUG] Hydration test message"
    log_entry = IngestLogEntry(
        workspace_id=workspace_id,
        source_id=source_id,
        raw_text=raw_content,
        level="DEBUG",
        message="Hydration test message"
    )
    
    print(f"Ingesting log: {raw_content}")
    app.method_ingest_logs(logs=[log_entry])
    
    print("Fetching logs via method_get_logs...")
    # The method expects keyword arguments that match GetLogsRequest
    result = app.method_get_logs(workspace_id=workspace_id, limit=10)
    
    print(f"RPC Result Summary: total={result.get('total')}, count={len(result.get('logs', []))}")
    
    if result["logs"]:
        for i, log in enumerate(result["logs"]):
            print(f"\n--- Log {i+1} ---")
            print(f"DB ID: {log.get('id')}")
            print(f"Line ID: {log.get('line_id')}")
            print(f"Source ID: {log.get('source_id')}")
            print(f"Raw Text: '{log.get('raw_text')}'")
            print(f"Message:  '{log.get('message')}'")
            
            if log.get("raw_text") == raw_content:
                print("✅ SUCCESS: raw_text matches original content.")
            else:
                print("❌ FAILURE: raw_text does not match.")
                
            if log.get("message") == raw_content:
                print("✅ SUCCESS: message hydrated correctly.")
            else:
                print("❌ FAILURE: message is empty or incorrect.")
    else:
        print("❌ FAILURE: No logs found in database after ingestion.")

if __name__ == "__main__":
    try:
        test_hydration()
    except Exception as e:
        import traceback
        traceback.print_exc()
        sys.exit(1)
