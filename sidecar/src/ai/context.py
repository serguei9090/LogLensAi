class SmartContextManager:
    def filter_logs(self, logs: list[dict], keep_levels: list[str]) -> list[dict]:
        return [log for log in logs if log.get("level") in keep_levels]
