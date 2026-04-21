# Smart Context Manager Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Create `sidecar/src/ai/context.py` to optimize the LLM context window by filtering mundane logs and summarizing repeated patterns.

**Architecture:** We will implement a `SmartContextManager` class in `sidecar/src/ai/context.py`. It will provide methods to filter logs by severity level and summarize consecutive logs with the same `cluster_id`. This will replace `sidecar/src/ai/context_manager.py` to follow the plan's exact file path.

**Tech Stack:** Python 3.12+, Pytest for TDD.

---

### Task 1: Initialize `sidecar/src/ai/context.py` and implement mundane filtering

**Files:**
- Create: `sidecar/src/ai/context.py`
- Create: `sidecar/tests/test_context.py`

- [ ] **Step 1: Write the failing test for mundane filtering**

```python
# sidecar/tests/test_context.py
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
```

- [ ] **Step 2: Run test to verify it fails**

Run: `pytest sidecar/tests/test_context.py`
Expected: FAIL with `ModuleNotFoundError: No module named 'ai.context'`

- [ ] **Step 3: Write minimal implementation**

```python
# sidecar/src/ai/context.py
class SmartContextManager:
    def filter_logs(self, logs: list[dict], keep_levels: list[str]) -> list[dict]:
        return [log for log in logs if log.get("level") in keep_levels]
```

- [ ] **Step 4: Run test to verify it passes**

Run: `pytest sidecar/tests/test_context.py`
Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add sidecar/src/ai/context.py sidecar/tests/test_context.py
git commit -m "feat(ai): add SmartContextManager with mundane log filtering"
```

---

### Task 2: Implement repeated log summarization

**Files:**
- Modify: `sidecar/src/ai/context.py`
- Modify: `sidecar/tests/test_context.py`

- [ ] **Step 1: Write failing test for summarization**

```python
# sidecar/tests/test_context.py
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
```

- [ ] **Step 2: Run test to verify it fails**

Run: `pytest sidecar/tests/test_context.py`
Expected: FAIL with `AttributeError: 'SmartContextManager' object has no attribute 'summarize_logs'`

- [ ] **Step 3: Write minimal implementation**

```python
# sidecar/src/ai/context.py
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
```

- [ ] **Step 4: Run test to verify it passes**

Run: `pytest sidecar/tests/test_context.py`
Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add sidecar/src/ai/context.py sidecar/tests/test_context.py
git commit -m "feat(ai): implement repeated log summarization in SmartContextManager"
```

---

### Task 3: Combine logic and Integrate into `api.py`

**Files:**
- Modify: `sidecar/src/ai/context.py`
- Modify: `sidecar/src/api.py`

- [ ] **Step 1: Write a unified preparation method in `SmartContextManager`**

```python
# sidecar/src/ai/context.py
class SmartContextManager:
    # ...
    def prepare_log_context(self, logs: list[dict], keep_levels: list[str] = None) -> str:
        if keep_levels is None:
            keep_levels = ["INFO", "WARN", "ERROR", "FATAL", "CRITICAL"]
        filtered = self.filter_logs(logs, keep_levels)
        if not filtered:
             filtered = logs[:20] # Fallback
        return self.summarize_logs(filtered)
```

- [ ] **Step 2: Update `api.py` to use `SmartContextManager` from `ai.context`**

- [ ] **Step 3: Run integration tests.**

- [ ] **Step 4: Commit.**

---

### Task 4: Cleanup redundant code

- [ ] **Step 1: Delete `sidecar/src/ai/context_manager.py` and its tests.**
- [ ] **Step 2: Commit.**
