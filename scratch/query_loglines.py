import os
import shutil
import duckdb

PROJECT_ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
DB_PATH = os.path.join(PROJECT_ROOT, "data", "loglens.duckdb")
TEMP_DB_PATH = os.path.join(PROJECT_ROOT, "data", "loglens_query_temp.duckdb")

print(f"Reading DB from {DB_PATH} (via temp copy)...")
try:
    if os.path.exists(TEMP_DB_PATH):
        os.remove(TEMP_DB_PATH)
    shutil.copy2(DB_PATH, TEMP_DB_PATH)
    
    conn = duckdb.connect(TEMP_DB_PATH)
    
    # 1. Total number of loglines in logs table
    total_count = conn.execute("SELECT COUNT(*) FROM logs").fetchone()[0]
    print(f"Total loglines in database: {total_count}")
    
    # 2. Distinct workspaces
    print("\nLoglines count by Workspace ID:")
    rows_ws = conn.execute("SELECT workspace_id, COUNT(*) FROM logs GROUP BY workspace_id").fetchall()
    for ws, cnt in rows_ws:
        print(f"  Workspace: {ws} -> Count: {cnt}")
        
    # 3. Log sources
    print("\nLog Sources in log_sources table:")
    rows_src = conn.execute("SELECT id, workspace_id, name, type, path FROM log_sources").fetchall()
    for row in rows_src:
        print(f"  ID: {row[0]}, Workspace: {row[1]}, Name: {row[2]}, Type: {row[3]}, Path: {row[4]}")
        
    # 4. Count by source_id
    print("\nLoglines count by Source ID (representing logs/catalogs):")
    rows_cnt = conn.execute("SELECT source_id, COUNT(*) FROM logs GROUP BY source_id").fetchall()
    for src_id, cnt in rows_cnt:
        # Resolve name from log_sources if possible
        src_name = conn.execute("SELECT name FROM log_sources WHERE id = ?", (src_id,)).fetchone()
        name_str = src_name[0] if src_name else "Unknown"
        print(f"  Source ID: {src_id} ({name_str}) -> Count: {cnt}")
        
    conn.close()
    os.remove(TEMP_DB_PATH)
except Exception as e:
    print(f"Error checking database: {e}")
