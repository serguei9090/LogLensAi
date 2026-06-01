import os

PROJECT_ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
LOG_PATH = os.path.join(PROJECT_ROOT, "sidecar", "sidecar.log")

if not os.path.exists(LOG_PATH):
    # Try current directory too
    LOG_PATH = os.path.join(PROJECT_ROOT, "sidecar.log")

print(f"Reading log from: {LOG_PATH}")
if os.path.exists(LOG_PATH):
    with open(LOG_PATH, "r", encoding="utf-8", errors="replace") as f:
        # Seek to near the end
        f.seek(0, 2)
        size = f.tell()
        # Read last 50KB
        f.seek(max(0, size - 100000), 0)
        lines = f.readlines()
        print(f"--- LAST 100 LINES of {LOG_PATH} ---")
        for line in lines[-100:]:
            print(line.strip())
else:
    print("Log file not found.")
