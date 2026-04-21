import pytest
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
    assert all(l["level"] in ["WARN", "ERROR"] for l in filtered)
