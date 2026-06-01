import sqlite3
import duckdb

try:
    conn = duckdb.connect("data/loglens.duckdb")
    cursor = conn.cursor()
    cursor.execute("SELECT value FROM settings WHERE key='drain_masks'")
    print(cursor.fetchone()[0])
except Exception as e:
    print(e)
