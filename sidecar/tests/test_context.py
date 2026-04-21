from ai.context import SmartContextManager


def test_filter_mundane_logs():
    logs = [
        {"level": "DEBUG", "message": "Debug message"},
        {"level": "INFO", "message": "Info message"},
        {"level": "WARN", "message": "Warn message"},
        {"level": "ERROR", "message": "Error message"},
    ]
    # Default behavior: Keep INFO and above
    manager = SmartContextManager()
    filtered = manager.filter_logs(logs, keep_levels=["WARN", "ERROR"])

    assert len(filtered) == 2
    assert all(log["level"] in ["WARN", "ERROR"] for log in filtered)


def test_summarize_repeated_logs():
    logs = [
        {"cluster_id": 1, "message": "Request failed", "timestamp": "2024-01-01 10:00:00"},
        {"cluster_id": 1, "message": "Request failed", "timestamp": "2024-01-01 10:00:01"},
        {"cluster_id": 1, "message": "Request failed", "timestamp": "2024-01-01 10:00:02"},
        {"cluster_id": 1, "message": "Request failed", "timestamp": "2024-01-01 10:00:03"},
        {"cluster_id": 2, "message": "Other error", "timestamp": "2024-01-01 10:00:04"},
    ]
    manager = SmartContextManager()
    summary = manager.summarize_logs(logs, threshold=3)

    # Expect one summarized entry for cluster 1 and one entry for cluster 2
    assert "[REPEATED 4x]" in summary
    assert "Other error" in summary
