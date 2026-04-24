# TODO(TEST-BE-001): sidecar/api.py Full JSON-RPC Parity Test Suite

## 🎯 Objective
Ensure every public method exposed via JSON-RPC in `api.py` is verified for input validation, success response, and error handling.

## 🏗️ Architectural Choice
- **Framework**: `pytest`
- **Isolation**: Use `db_path=":memory:"` for hermetic tests.
- **Pattern**:
  - `test_method_success`: Valid params -> expected result.
  - `test_method_validation_error`: Invalid params -> Pydantic error (400 equivalent).
  - `test_method_internal_error`: Simulating DB/Engine failure -> 500 equivalent.

## 📋 Coverage List
1. `get_logs` (pagination, filtering, sorting)
2. `get_fused_logs`
3. `start_tail` / `stop_tail`
4. `ingest_logs`
5. `analyze_cluster`
6. `get_anomalies`
7. `update_settings` / `get_settings`
8. `start_ssh_tail` (Mock paramiko)
