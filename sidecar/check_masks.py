import duckdb
conn = duckdb.connect('loglens.duckdb')
try:
    res = conn.execute("SELECT value FROM settings WHERE key='drain_masks'").fetchone()
    print(res[0] if res else 'None')
except Exception as e:
    print(f"Error: {e}")
finally:
    conn.close()
