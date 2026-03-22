# API Specification: Tauri ↔ Python Sidecar

## Communication Protocol
- **Transport**: Standard Input (STDIN) / Standard Output (STDOUT)
- **Protocol**: JSON-RPC 2.0
- **Serialization**: JSON

## Base JSON-RPC Format
### Request
```json
{
  "jsonrpc": "2.0",
  "method": "<method_name>",
  "params": {},
  "id": 1
}
```

### Response (Success)
```json
{
  "jsonrpc": "2.0",
  "result": {},
  "id": 1
}
```

### Response (Error)
```json
{
  "jsonrpc": "2.0",
  "error": {
    "code": -32600,
    "message": "Invalid Request"
  },
  "id": 1
}
```

## Methods
### `ping`
Heartbeat check to ensure the sidecar is responsive.
- **params**: None
- **result**: `{"status": "ok", "version": "1.0.0"}`

### `query_logs`
Fetch a paginated block of parsed logs.
- **params**: `{"offset": 0, "limit": 100, "filters": {"level": "ERROR"}}`
- **result**: `{"logs": [{...}], "total": 5430}`

### `get_health`
Retrieve the health status and resource usage of the Sidecar engine.
- **params**: None
- **result**: `{"status": "ok", "memory_usage": 124.5, "ingestion_rate": 5400, "db_size": 24000000}`
