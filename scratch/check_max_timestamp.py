import os
import duckdb

PROJECT_ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
DB_PATH = os.path.join(PROJECT_ROOT, "data", "loglens.duckdb")

try:
    print(f"Connecting to DB in read-only mode: {DB_PATH}")
    conn = duckdb.connect(DB_PATH, read_only=True)
    
    # Get max timestamp
    min_ts, max_ts = conn.execute("SELECT MIN(timestamp), MAX(timestamp) FROM logs").fetchone()
    print(f"Database Min Timestamp: {min_ts}")
    print(f"Database Max Timestamp: {max_ts}")
    
    # Let's count how many logs match the normal count
    total = conn.execute("SELECT COUNT(*) FROM logs").fetchone()[0]
    print(f"Total logs: {total}")
    
    # Simulating front-end: start_time = min_ts, end_time = max_ts
    # In _prepare_dashboard_where:
    norm_start = min_ts.replace("T", " ").split(".")[0].replace("Z", "")
    norm_end = max_ts.replace("T", " ").split(".")[0].replace("Z", "")
    
    print(f"Normalized Start: {norm_start}")
    print(f"Normalized End: {norm_end}")
    
    # Count with filtered bounds
    cnt_filtered = conn.execute("SELECT COUNT(*) FROM logs WHERE timestamp >= ? AND timestamp <= ?", (norm_start, norm_end)).fetchone()[0]
    print(f"Filtered count (timestamp <= {norm_end}): {cnt_filtered}")
    
    # How many logs have timestamp > norm_end?
    greater_logs = conn.execute("SELECT id, timestamp, raw_text FROM logs WHERE timestamp > ? LIMIT 5", (norm_end,)).fetchall()
    print(f"Logs with timestamp > {norm_end}:")
    for r in greater_logs:
        print(f"  ID: {r[0]}, TS: {r[1]}, Text: {r[2][:80]}")
        
    conn.close()
except Exception as e:
    print(f"Error: {e}")
