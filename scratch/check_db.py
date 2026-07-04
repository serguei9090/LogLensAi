import duckdb
import os

db_path = "data/loglens.duckdb"
if not os.path.exists(db_path):
    print(f"Database not found at {db_path}")
    exit(1)

conn = duckdb.connect(db_path, read_only=True)
print("=== ingestion_jobs ===")
jobs = conn.execute("SELECT id, workspace_id, source_id, status, total_lines, processed_lines FROM ingestion_jobs").fetchall()
for job in jobs:
    print(job)

print("=== log_sources ===")
sources = conn.execute("SELECT id, name, is_uploaded FROM log_sources").fetchall()
for src in sources:
    print(src)

conn.close()
