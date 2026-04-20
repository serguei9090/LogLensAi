import logging

logger = logging.getLogger("LogLensContextManager")


class ContextManager:
    """
    Optimizes log context for AI consumption.
    Filters mundane logs (DEBUG/INFO unless specifically requested)
    and summarizes repetitive clusters to save tokens.
    """

    @staticmethod
    def prepare_log_context(
        logs: list[dict], max_tokens: int = 4000, keep_levels: list[str] = None
    ) -> str:
        """
        Processes a list of log dicts and returns a summarized string.
        Optimizes for token usage by filtering noise and summarizing repetitions.
        """
        if not logs:
            return ""

        if keep_levels is None:
            keep_levels = ["INFO", "WARN", "ERROR", "FATAL", "CRITICAL"]

        processed_lines = []
        cluster_counts = {}

        # 1. Filter logs by level
        filtered_logs = [log for log in logs if log.get("level") in keep_levels]

        if not filtered_logs:
            # Fallback: if all logs were filtered but we have logs, take a sample of the original
            filtered_logs = logs[:20]

        # 2. Count clusters for summarization
        for log in filtered_logs:
            cluster_id = log.get("cluster_id")
            if cluster_id:
                cluster_counts[cluster_id] = cluster_counts.get(cluster_id, 0) + 1

        # 3. Build context string with smart summarization
        seen_clusters = set()
        for log in filtered_logs:
            cluster_id = log.get("cluster_id")
            count = cluster_counts.get(cluster_id, 0)

            if cluster_id and count > 3:
                if cluster_id not in seen_clusters:
                    msg = log.get("message") or log.get("raw_text")
                    # Use template if available for better summarization
                    template = log.get("template") or msg
                    processed_lines.append(f"[REPEATED {count}x] [Cluster {cluster_id}] {template}")
                    seen_clusters.add(cluster_id)
                continue

            # For unique or low-frequency logs, include full line
            ts = log.get("timestamp", "")
            lvl = log.get("level", "INFO")
            msg = log.get("message") or log.get("raw_text")
            processed_lines.append(f"{ts} [{lvl}] {msg}")

        # 4. Final assembly with character-based truncation (approx 4 chars per token)
        # We target max_tokens * 3.5 to be safe
        max_chars = int(max_tokens * 3.5)
        context_str = "\n".join(processed_lines)

        if len(context_str) > max_chars:
            return context_str[:max_chars] + "\n... [Truncated to fit LLM Context Window]"

        return context_str
