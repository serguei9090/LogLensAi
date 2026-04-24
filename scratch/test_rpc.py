import requests


def test_rpc():
    url = "http://localhost:5000/rpc"
    payload = {
        "jsonrpc": "2.0",
        "id": 1,
        "method": "get_hierarchy",
        "params": {"workspace_id": "ws-test"},
    }
    try:
        resp = requests.post(url, json=payload)
        print(f"Status: {resp.status_code}")
        print(f"Response: {resp.text}")
    except Exception as e:
        print(f"Error: {e}")


if __name__ == "__main__":
    test_rpc()
