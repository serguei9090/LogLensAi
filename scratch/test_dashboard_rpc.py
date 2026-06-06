import requests
import json

def compare_dashboard_stats():
    url = "http://localhost:5000/rpc"
    
    # 1. First request: no time bounds
    payload1 = {
        "jsonrpc": "2.0",
        "id": 1,
        "method": "get_dashboard_stats",
        "params": {
            "workspace_id": "default-ws",
            "active_workspace_ids": ["default-ws"]
        }
    }
    
    try:
        resp1 = requests.post(url, json=payload1)
        data1 = resp1.json()
        if data1.get("error") is not None:
            print("RPC 1 Error:", data1["error"])
            return
            
        result1 = data1["result"]
        total_logs_1 = result1["total_logs"]
        time_bounds = result1["time_bounds"]
        print(f"First load (No filters):")
        print(f"  total_logs: {total_logs_1}")
        print(f"  time_bounds: {time_bounds}")
        
        # 2. Second request: with start_time and end_time set to time_bounds
        payload2 = {
            "jsonrpc": "2.0",
            "id": 2,
            "method": "get_dashboard_stats",
            "params": {
                "workspace_id": "default-ws",
                "active_workspace_ids": ["default-ws"],
                "start_time": time_bounds["min"],
                "end_time": time_bounds["max"]
            }
        }
        
        resp2 = requests.post(url, json=payload2)
        data2 = resp2.json()
        if data2.get("error") is not None:
            print("RPC 2 Error:", data2["error"])
            return
            
        result2 = data2["result"]
        total_logs_2 = result2["total_logs"]
        print(f"\nSecond load (With time bounds filtering):")
        print(f"  start_time sent: {time_bounds['min']}")
        print(f"  end_time sent:   {time_bounds['max']}")
        print(f"  total_logs:      {total_logs_2}")
        print(f"  Difference:      {total_logs_1 - total_logs_2} record(s)")
        
        # Let's inspect what the maximum timestamp would normalize to
        # In _prepare_dashboard_where:
        # norm_end = end_time.replace("T", " ").split(".")[0].replace("Z", "")
        max_ts = time_bounds["max"]
        norm_end = max_ts.replace("T", " ").split(".")[0].replace("Z", "")
        print(f"\nTime bound normalization check:")
        print(f"  Original Max TS:  {max_ts}")
        print(f"  Normalized End:   {norm_end}")
        if max_ts != norm_end:
            print(f"  -> WARNING: Milliseconds or timezone designators were stripped!")
            print(f"  -> Comparison in SQL is: timestamp <= '{norm_end}'")
            print(f"  -> Because of this, any log line with a timestamp greater than '{norm_end}' (e.g. '{max_ts}') is excluded.")
            
    except Exception as e:
        print("Error connecting to RPC server:", e)

if __name__ == "__main__":
    compare_dashboard_stats()
