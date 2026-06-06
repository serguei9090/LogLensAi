import duckdb

con = duckdb.connect('data/loglens.duckdb', read_only=True)
cursor = con.cursor()

# Query count, min timestamp, max timestamp
cursor.execute("SELECT COUNT(*), MIN(timestamp), MAX(timestamp) FROM logs")
print("Stats from logs table:", cursor.fetchone())

# Query a sample of timestamps
cursor.execute("SELECT timestamp, raw_text FROM logs ORDER BY timestamp DESC LIMIT 5")
print("\nLatest 5 logs in DB:")
for r in cursor.fetchall():
    print(r)

# Query logs that have very large years (e.g. > 2030)
cursor.execute("SELECT timestamp, raw_text FROM logs WHERE timestamp > '2030-01-01' ORDER BY timestamp DESC")
rows = cursor.fetchall()
print(f"\nLogs after 2030 (Total: {len(rows)}):")
for r in rows[:10]:
    print(r)
