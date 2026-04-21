class SmartContextManager:
    def filter_logs(self, logs: list[dict], keep_levels: list[str]) -> list[dict]:
        return [log for log in logs if log.get("level") in keep_levels]

    def summarize_logs(self, logs: list[dict], threshold: int = 3) -> str:
        if not logs:
            return ""

        cluster_counts = {}
        for log in logs:
            cid = log.get("cluster_id")
            if cid:
                cluster_counts[cid] = cluster_counts.get(cid, 0) + 1

        processed_lines = []
        seen_clusters = set()

        for log in logs:
            cid = log.get("cluster_id")
            count = cluster_counts.get(cid, 0)

            if cid and count > threshold:
                if cid not in seen_clusters:
                    msg = log.get("message") or log.get("raw_text", "")
                    processed_lines.append(f"[REPEATED {count}x] [Cluster {cid}] {msg}")
                    seen_clusters.add(cid)
                continue

            lvl = log.get("level", "INFO")
            msg = log.get("message") or log.get("raw_text", "")
            processed_lines.append(f"[{lvl}] {msg}")

        return "\n".join(processed_lines)
