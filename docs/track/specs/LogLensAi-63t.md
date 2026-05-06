# Implementation Spec: Health Stabilization (SRP, Caching, and API Cleanup)

**Bead ID**: LogLensAi-63t
**Status**: DRAFT
**Persona**: @pm

## 1. Overview
This task addresses architectural debt and anti-patterns identified in the 2026-05-06 health audit. The focus is on improving performance via caching, enhancing API safety with strict validation, and refactoring the primary entry point to adhere to the Single Responsibility Principle (SRP).

## 2. Proposed Changes

### 2.1 API Validation & Parameters
- **File**: `sidecar/src/models.py`
  - Create `AnalyzeClusterRequest` model:
    ```python
    class AnalyzeClusterRequest(BaseModel):
        cluster_id: str
        workspace_id: str
        sample_size: int = 20  # Explicit sample size with default
    ```
- **File**: `sidecar/src/api.py`
  - Update `method_analyze_cluster` to accept `AnalyzeClusterRequest` instead of raw arguments.
  - Replace hardcoded `LIMIT 20` with `params.sample_size`.

### 2.2 Performance: Rules Caching
- **File**: `sidecar/src/tailer.py`
  - Add `_rules_cache: dict[str, list]` class or instance level cache.
  - Implement `_get_cached_rules(workspace_id)` logic to avoid DB roundtrips for every line.
  - Set a cache TTL or implement a simple refresh every N seconds to balance performance and freshness.

### 2.3 Architectural Refactor (SRP)
- **File**: `sidecar/src/api.py`
  - **Problem**: The `App` class is becoming a "God Object" handling both transport-level dispatch and domain logic.
  - **Interim Refactor**: 
    - Extract AI-heavy logic (session management, analysis) to a new `AIService` class or move more implementation details into `sidecar/src/ai/runner.py`.
    - Ensure `api.py` methods primarily call out to specialized managers (DB, Parser, AI, Tailer).

### 2.4 Thinking Parser Cleanup
- **File**: `sidecar/src/ai/thinking_parser.py`
  - Address `TODO(think_parser_001)`: 
    - Verify regex patterns for latest models (Gemma 4, DeepSeek R1).
    - Ensure robust handling of interleaved markers in edge cases (e.g., markers split across tokens).

## 3. Verification Plan

### 3.1 Automated Tests
- **New Tests**:
  - `sidecar/tests/test_api_refactor.py`: Verify that the new `AnalyzeClusterRequest` works and respects `sample_size`.
  - `sidecar/tests/test_tailer_caching.py`: Mock DB calls in `FileTailer` and verify that `_process_line` only queries the DB once for multiple lines.
- **Regression Tests**:
  - Run `pytest sidecar/tests/test_api_methods.py` to ensure no breakages in existing JSON-RPC methods.

### 3.2 Manual Verification
- Trigger a cluster analysis from the UI and verify (via logs) that the correct sample size is fetched from DuckDB.
- Monitor sidecar CPU usage during a high-speed log tail to verify caching benefit.
