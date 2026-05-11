
with open("sidecar/src/api.py", encoding="utf-8") as f:
    content = f.read()

start_idx = content.find("    def _ingest_single_log(")
if start_idx != -1:
    end_idx = content.find("    def method_ingest_logs(", start_idx)
    content = content[:start_idx] + content[end_idx:]
    with open("sidecar/src/api.py", "w", encoding="utf-8") as f:
        f.write(content)
    print("Removed _ingest_single_log")
else:
    print("_ingest_single_log not found")
