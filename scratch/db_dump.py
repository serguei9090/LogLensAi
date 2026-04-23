import os

import duckdb

DB_PATH = r"i:\01-Master_Code\Apps\LogLensAi\data\loglens.duckdb"


def dump_db():
    if not os.path.exists(DB_PATH):
        print(f"DB NOT FOUND at {DB_PATH}")
        return

    print(f"DB FOUND at {DB_PATH}")
    conn = duckdb.connect(DB_PATH)

    tables = conn.execute(
        "SELECT table_name FROM information_schema.tables WHERE table_schema = 'main'"
    ).fetchall()
    print(f"Tables: {[t[0] for t in tables]}")

    for table in [t[0] for t in tables]:
        count = conn.execute(f"SELECT COUNT(*) FROM {table}").fetchone()[0]
        print(f"Table {table}: {count} rows")
        if count > 0:
            cols = [c[1] for c in conn.execute(f"PRAGMA table_info('{table}')").fetchall()]
            rows = conn.execute(f"SELECT * FROM {table} LIMIT 5").fetchall()
            print(f"  Columns: {cols}")
            for row in rows:
                print(f"  {row}")

    conn.close()


if __name__ == "__main__":
    dump_db()
