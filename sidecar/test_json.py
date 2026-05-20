import duckdb
conn = duckdb.connect()
conn.execute("CREATE TABLE logs (facets VARCHAR)")
conn.execute("INSERT INTO logs VALUES ('{\"ip\": \"1.2.3.4\"}')")
print("With quotes:", conn.execute("SELECT json_extract_string(facets, '$.\"ip\"') FROM logs").fetchall())
print("Without quotes:", conn.execute("SELECT json_extract_string(facets, '$.ip') FROM logs").fetchall())
