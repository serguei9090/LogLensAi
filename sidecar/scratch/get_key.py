import os

import duckdb

DB_PATH = r"i:\01-Master_Code\Apps\LogLensAi\data\loglens.duckdb"


def get_api_key():
    if not os.path.exists(DB_PATH):
        print(f"DB not found at {DB_PATH}")
        return None

    conn = duckdb.connect(DB_PATH)
    res = conn.execute("SELECT value FROM settings WHERE key='ai_api_key'").fetchone()
    conn.close()

    if res:
        return res[0]
    return None


if __name__ == "__main__":
    key = get_api_key()
    if key:
        print(key)
    else:
        print("NOT_FOUND")
