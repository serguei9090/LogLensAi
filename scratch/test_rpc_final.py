import json

import requests

url = "http://localhost:5000/rpc"

payload_hierarchy = {
    "jsonrpc": "2.0",
    "id": 1,
    "method": "get_hierarchy",
    "params": {"workspace_id": "ws-1"}
}

payload_create = {
    "jsonrpc": "2.0",
    "id": 2,
    "method": "create_log_source",
    "params": {
        "workspace_id": "ws-1",
        "name": "Test Source",
        "type": "local",
        "path": "C:\\temp\\test.log"
    }
}

try:
    print("Testing get_hierarchy...")
    response = requests.post(url, json=payload_hierarchy)
    print(f"Status: {response.status_code}")
    print(f"Body: {json.dumps(response.json(), indent=2)}")
    
    print("\nTesting create_log_source...")
    response_create = requests.post(url, json=payload_create)
    print(f"Status: {response_create.status_code}")
    print(f"Body: {json.dumps(response_create.json(), indent=2)}")
except Exception as e:
    print(f"Error: {e}")
