import os
import time

import requests


def ingest_file(filepath, workspace_id="default-workspace"):
    url = "http://localhost:5000/rpc"  # Added /rpc
    batch_size = 500

    if not os.path.exists(filepath):
        print(f"File not found: {filepath}")
        return

    with open(filepath, encoding="utf-8", errors="replace") as f:
        lines = f.readlines()

    print(f"Total lines to ingest: {len(lines)}")

    for i in range(0, len(lines), batch_size):
        batch = lines[i : i + batch_size]
        log_entries = []
        for line in batch:
            if not line.strip():
                continue
            log_entries.append(
                {
                    "workspace_id": workspace_id,
                    "source_id": "test-ingestion",
                    "raw_text": line.strip(),
                    "level": "INFO",
                }
            )

        if not log_entries:
            continue

        payload = {
            "jsonrpc": "2.0",
            "method": "ingest_logs",
            "params": {"logs": log_entries},
            "id": i,
        }

        try:
            response = requests.post(url, json=payload)
            print(f"Batch {i // batch_size + 1}: {response.json()}")
        except Exception as e:
            print(f"Error in batch {i // batch_size + 1}: {e}")
            if hasattr(e, "response"):
                print(f"Response: {e.response.text}")

        time.sleep(0.1)


if __name__ == "__main__":
    ingest_file("i:/server.log")
