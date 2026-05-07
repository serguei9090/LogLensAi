import os
import json
import duckdb
import sys
import threading
from datetime import datetime

# Locate database
SIDE_CAR_DIR = os.path.dirname(os.path.abspath(__file__))
PROJECT_ROOT = os.path.dirname(SIDE_CAR_DIR)
DB_PATH = os.path.join(PROJECT_ROOT, "data", "loglens.duckdb")

def get_db_info():
    if not os.path.exists(DB_PATH):
        return {"error": f"Database not found at {DB_PATH}"}

    try:
        # Use a timeout or a separate connection to avoid hangs if locked
        conn = duckdb.connect(DB_PATH, read_only=True)
        cursor = conn.cursor()

        # 1. Workspace Inventory (based on logs)
        cursor.execute("SELECT workspace_id, COUNT(*) as log_count FROM logs GROUP BY workspace_id")
        workspace_logs = [{"id": r[0], "count": r[1]} for r in cursor.fetchall()]

        # 2. Workspace Settings Inventory
        cursor.execute("SELECT DISTINCT workspace_id FROM workspace_settings")
        workspace_settings = [r[0] for r in cursor.fetchall()]

        # 3. Log Sources
        cursor.execute("SELECT workspace_id, id, name, type, path FROM log_sources")
        log_sources = [{"workspace_id": r[0], "id": r[1], "name": r[2], "type": r[3], "path": r[4]} for r in cursor.fetchall()]

        # 4. Folders
        cursor.execute("SELECT workspace_id, id, name FROM folders")
        folders = [{"workspace_id": r[0], "id": r[1], "name": r[2]} for r in cursor.fetchall()]

        # 5. Clusters/Templates
        cursor.execute("SELECT workspace_id, COUNT(*) as pattern_count FROM clusters GROUP BY workspace_id")
        clusters = [{"workspace_id": r[0], "count": r[1]} for r in cursor.fetchall()]

        # 6. Global stats from the dashboard logic
        cursor.execute("SELECT COUNT(DISTINCT workspace_id) FROM logs")
        dashboard_workspace_count = cursor.fetchone()[0]

        # 7. List all unique workspace_id values across all tables
        cursor.execute("""
            SELECT workspace_id, 'logs' as source FROM logs GROUP BY workspace_id
            UNION
            SELECT workspace_id, 'clusters' as source FROM clusters GROUP BY workspace_id
            UNION
            SELECT workspace_id, 'log_sources' as source FROM log_sources GROUP BY workspace_id
            UNION
            SELECT workspace_id, 'folders' as source FROM folders GROUP BY workspace_id
        """)
        all_refs = {}
        for r in cursor.fetchall():
            ws_id = r[0]
            source = r[1]
            if ws_id not in all_refs:
                all_refs[ws_id] = []
            all_refs[ws_id].append(source)

        return {
            "status": "success",
            "timestamp": datetime.now().isoformat(),
            "db_path": DB_PATH,
            "metrics": {
                "unique_workspace_ids_in_logs": dashboard_workspace_count,
                "total_log_sources": len(log_sources),
                "total_folders": len(folders)
            },
            "workspaces_with_logs": workspace_logs,
            "workspaces_in_settings": workspace_settings,
            "log_sources_detail": log_sources,
            "folders_detail": folders,
            "templates_by_workspace": clusters,
            "all_detected_workspace_ids": all_refs
        }

    except Exception as e:
        return {"status": "error", "error": str(e)}
    finally:
        if 'conn' in locals():
            conn.close()

if __name__ == "__main__":
    # If file is locked, we can't do much from a separate process without stopping the sidecar.
    # However, DuckDB read_only=True usually works if the other process is just reading/writing
    # unless it has an exclusive lock.
    result = get_db_info()
    print(json.dumps(result, indent=2))
