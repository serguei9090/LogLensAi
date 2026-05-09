import json
import os
from datetime import datetime

import duckdb

# DB Path
DB_PATH = os.path.join(os.getcwd(), "data", "loglens.duckdb")


def run_diagnostic():
    if not os.path.exists(DB_PATH):
        return {"error": f"Database not found at {DB_PATH}"}

    # Use read_only=True to avoid locking issues if the app is running
    try:
        conn = duckdb.connect(DB_PATH, read_only=True)
    except Exception as e:
        return {"error": f"Failed to connect to database: {str(e)}"}

    tables = [
        "logs",
        "clusters",
        "log_sources",
        "folders",
        "log_streams",
        "workspace_settings",
        "settings",
        "temporal_offsets",
        "fusion_configs",
        "ai_sessions",
        "ai_messages",
        "ai_memory",
        "anomalies",
        "settings_templates",
    ]

    result = {"timestamp": datetime.now().isoformat(), "database_path": DB_PATH, "tables": {}}

    for table in tables:
        try:
            # Check if table exists
            table_check = conn.execute(
                f"SELECT count(*) FROM information_schema.tables WHERE table_name = '{table}'"
            ).fetchone()[0]
            if not table_check:
                result["tables"][table] = {"status": "missing"}
                continue

            # Count rows
            count = conn.execute(f"SELECT COUNT(*) FROM {table}").fetchone()[0]

            # Get columns
            desc = conn.execute(f"SELECT * FROM {table} LIMIT 0").description
            columns = [d[0] for d in desc]

            # Get sample rows (up to 5)
            rows = conn.execute(f"SELECT * FROM {table} LIMIT 5").fetchall()

            result["tables"][table] = {
                "count": count,
                "columns": columns,
                "samples": [dict(zip(columns, r)) for r in rows],
            }

            # Special aggregation for logs and log_sources
            if table == "logs":
                ws_counts = conn.execute(
                    "SELECT workspace_id, COUNT(*) FROM logs GROUP BY workspace_id"
                ).fetchall()
                result["tables"][table]["workspace_breakdown"] = {
                    str(r[0]): r[1] for r in ws_counts
                }

                source_counts = conn.execute(
                    "SELECT workspace_id, source_id, COUNT(*) FROM logs GROUP BY workspace_id, source_id"
                ).fetchall()
                result["tables"][table]["source_breakdown"] = [
                    {"workspace": str(r[0]), "source": str(r[1]), "count": r[2]}
                    for r in source_counts
                ]

            if table == "log_sources":
                ls_details = conn.execute(
                    "SELECT workspace_id, id, name, path FROM log_sources"
                ).fetchall()
                result["tables"][table]["details"] = [
                    {"workspace": str(r[0]), "id": str(r[1]), "name": r[2], "path": r[3]}
                    for r in ls_details
                ]

            if table == "workspace_settings":
                ws_settings = conn.execute(
                    "SELECT workspace_id, key, value FROM workspace_settings"
                ).fetchall()
                result["tables"][table]["all_settings"] = [
                    {"workspace": str(r[0]), "key": r[1], "value": r[2]} for r in ws_settings
                ]

        except Exception as e:
            result["tables"][table] = {"error": str(e)}

    conn.close()
    return result


if __name__ == "__main__":
    diag = run_diagnostic()
    print(json.dumps(diag, indent=2, default=str))
