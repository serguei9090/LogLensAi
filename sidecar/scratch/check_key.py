import os

import duckdb

DB_PATH = r"i:\01-Master_Code\Apps\LogLensAi\data\loglens.duckdb"


def check_key_length():
    if not os.path.exists(DB_PATH):
        return "DB NOT FOUND"

    conn = duckdb.connect(DB_PATH)
    res = conn.execute("SELECT value FROM settings WHERE key='ai_api_key'").fetchone()
    conn.close()

    if res:
        val = res[0]
        return f"LEN={len(val)}, STRIPPED_LEN={len(val.strip())}"
    return "KEY NOT FOUND"


if __name__ == "__main__":
    print(check_key_length())
