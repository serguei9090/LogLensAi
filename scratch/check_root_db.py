import os

import duckdb

db_path = r"i:\01-Master_Code\Apps\LogLensAi\data\loglens.duckdb"
if not os.path.exists(db_path):
    print(f"DB NOT FOUND at {db_path}")
else:
    print(f"DB FOUND at {db_path}")
    try:
        conn = duckdb.connect(db_path, read_only=True)
        print("Schema:")
        print(conn.execute("SELECT table_name FROM information_schema.tables").fetchall())

        print("\nWorkspaces and Log counts:")
        print(
            conn.execute("SELECT workspace_id, count(*) FROM logs GROUP BY workspace_id").fetchall()
        )

        print("\nLast 5 logs:")
        print(conn.execute("SELECT * FROM logs ORDER BY timestamp DESC LIMIT 5").fetchall())
        conn.close()
    except Exception as e:
        print(f"ERROR: {e}")
