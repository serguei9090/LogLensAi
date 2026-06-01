import os
import shutil
import duckdb

PROJECT_ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
DB_PATH = os.path.join(PROJECT_ROOT, "data", "loglens.duckdb")
TEMP_DB_PATH = os.path.join(PROJECT_ROOT, "data", "loglens_inspect.duckdb")

print(f"Copying database from {DB_PATH} to {TEMP_DB_PATH}")
try:
    if os.path.exists(TEMP_DB_PATH):
        os.remove(TEMP_DB_PATH)
    shutil.copy2(DB_PATH, TEMP_DB_PATH)
    print("Copy successful.")
except Exception as e:
    print(f"Failed to copy DB: {e}")
    # Try copying even if locked (sometimes copy fails, sometimes succeeds depending on sharing flags)
    try:
        shutil.copy(DB_PATH, TEMP_DB_PATH)
        print("Fallback copy successful.")
    except Exception as e2:
        print(f"Fallback copy failed: {e2}")

if os.path.exists(TEMP_DB_PATH):
    conn = duckdb.connect(TEMP_DB_PATH)

    # Check settings
    print("\n--- SETTINGS ---")
    settings = conn.execute("SELECT key, value FROM settings").fetchall()
    for k, v in settings:
        print(f"{k}: {v}")

    # Check workspace settings
    print("\n--- WORKSPACE SETTINGS ---")
    w_settings = conn.execute("SELECT workspace_id, key, value FROM workspace_settings").fetchall()
    for ws, k, v in w_settings:
        print(f"[{ws}] {k}: {v}")

    # Check workspaces/logs present
    print("\n--- DISTINCT WORKSPACE_IDS IN LOGS ---")
    workspaces = conn.execute("SELECT DISTINCT workspace_id FROM logs").fetchall()
    for ws in workspaces:
        print(ws)

    # Check log sources
    print("\n--- LOG SOURCES ---")
    sources = conn.execute("SELECT id, name, path FROM log_sources").fetchall()
    for sid, name, path in sources:
        print(f"ID: {sid}, Name: {name}, Path: {path}")

    # Check first 5 logs
    print("\n--- LOGS (First 5) ---")
    logs = conn.execute("SELECT id, workspace_id, source_id, processed, level, cluster_id, facets FROM logs LIMIT 5").fetchall()
    for row in logs:
        print(row)

    # Check distinct facets stored in database
    print("\n--- DISTINCT DYNAMIC FACET KEYS ---")
    try:
        keys = conn.execute("SELECT DISTINCT UNNEST(json_keys(facets)) FROM logs").fetchall()
        print("Keys found:", [r[0] for r in keys])
    except Exception as e:
        print("Error getting keys:", e)

    conn.close()
    try:
        os.remove(TEMP_DB_PATH)
    except Exception:
        pass
else:
    print("Inspection DB does not exist.")
