import duckdb

conn = duckdb.connect()
conn.execute("CREATE TABLE logs (facets VARCHAR)")
conn.execute("INSERT INTO logs VALUES ('{\"ip\": \"1.2.3.4\", \"user\": \"admin\"}')")
conn.execute("INSERT INTO logs VALUES ('{\"ip\": \"5.6.7.8\", \"status\": \"200\"}')")

print(conn.execute("SELECT DISTINCT UNNEST(json_keys(facets)) FROM logs").fetchall())
