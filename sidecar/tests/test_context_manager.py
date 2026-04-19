import pytest
from ai.context_manager import ContextManager

def test_prepare_log_context_filtering():
    logs = [
        {"level": "DEBUG", "message": "debug msg", "timestamp": "2023-10-25 10:00:00"},
        {"level": "INFO", "message": "info msg", "timestamp": "2023-10-25 10:00:01"},
        {"level": "ERROR", "message": "error msg", "timestamp": "2023-10-25 10:00:02"},
    ]
    context = ContextManager.prepare_log_context(logs)
    assert "debug msg" not in context
    assert "info msg" in context
    assert "error msg" in context

def test_prepare_log_context_summarization():
    logs = [
        {"level": "INFO", "message": "repetitive msg", "cluster_id": "c1", "timestamp": "2023-10-25 10:00:00"},
        {"level": "INFO", "message": "repetitive msg", "cluster_id": "c1", "timestamp": "2023-10-25 10:00:01"},
        {"level": "INFO", "message": "repetitive msg", "cluster_id": "c1", "timestamp": "2023-10-25 10:00:02"},
        {"level": "INFO", "message": "repetitive msg", "cluster_id": "c1", "timestamp": "2023-10-25 10:00:03"},
        {"level": "INFO", "message": "unique msg", "cluster_id": "c2", "timestamp": "2023-10-25 10:00:04"},
    ]
    context = ContextManager.prepare_log_context(logs)
    assert "[REPEATED 4x]" in context
    assert "Cluster c1" in context
    assert "repetitive msg" in context
    assert "unique msg" in context

def test_prepare_log_context_truncation():
    logs = [{"level": "INFO", "message": "A" * 1000, "timestamp": str(i)} for i in range(10)]
    context = ContextManager.prepare_log_context(logs, max_tokens=100)
    assert len(context) <= 350 + len("\n... [Truncated to fit LLM Context Window]")
    assert "[Truncated to fit LLM Context Window]" in context
