# Testing Strategy & Coverage (testing.md)

This document tracks the testing state of the LogLensAi ecosystem, including Unit, Integration, and E2E tests.

## 👤 Persona: `@qa-arch`
Expert in test automation, code coverage, and regression prevention. Focuses on the "Continuous Quality" pipeline.

## 🛠️ Testing Stack

| Layer | Tools | Command |
|---|---|---|
| **Frontend** | Vitest, React Testing Library | `bun run test` |
| **Backend** | Pytest, unittest.mock | `pytest sidecar/tests/` |
| **Desktop Shell** | Tauri Gherkin (Future-scoped) | `npm run tauri test` |
| **Logic** | Filter Validation Tests | `pytest sidecar/tests/test_filters.py` |
| **E2E** | Python Integration Tests | `pytest sidecar/tests/test_e2e_ingestion.py` |

## 🧠 Testing Philosophy (ADK Standard)

- **Use real code over mocks**: ADK tests should use real implementations as much as possible instead of mocking. Only mock external dependencies like network calls or cloud services.
- **Test interface behavior, not implementation details**: Verify the public API behaves correctly, not *how* it's implemented internally. This makes tests resilient to refactoring.
- **Test Requirements**:
  - Fast and isolated tests where possible.
  - Use real ADK components; mock only external dependencies (LLM APIs, cloud services, etc.).
  - Focus on testing public interfaces and behavior, not internal implementation.
  - High coverage for new features, edge cases, and error conditions.
  - Location: `tests/unittests/` (following source structure).

## 📊 Coverage Matrix (Backend Sidecar)

| Method | Unit Test | Integration Test | Status |
|---|---|---|---|
| `method_get_logs` | ✅ `test_api_methods.py` | ✅ | Ready |
| `method_get_fused_logs` | ✅ `test_api_methods.py` | ✅ | Ready |
| `method_ingest_logs` | ✅ `test_api_methods.py` | ✅ `test_e2e_ingestion.py` | Ready |
| `method_get_distribution`| ✅ `test_api_methods.py` | ✅ | Ready |
| `method_get_anomalies` | ✅ `test_anomalies.py` | ❌ | Ready |
| `method_update_comment` | ✅ `test_api_methods.py` | ❌ | Ready |
| `method_analyze_cluster`| ✅ `test_api_methods.py` | ❌ | Ready (Mocked) |
| `method_start_tail` | ❌ | ❌ | Coverage Gap |
| `method_stop_tail` | ❌ | ❌ | Coverage Gap |
| `method_get_settings` | ✅ `test_api_methods.py` | ✅ | Ready |
| `method_update_settings` | ✅ `test_api_methods.py` | ✅ | Ready |
| `method_get_clusters` | ✅ `test_mcp.py` | ❌ | Ready (MCP side) |
| `method_update_fusion_config` | ✅ `test_api_methods.py` | ❌ | Ready |
| `method_get_health` | ❌ | ❌ | **Missing Method Implementation** |
| `method_ping` | ❌ | ❌ | **Missing Method Implementation** |

## 📊 Coverage Matrix (Frontend React)

| Component / Logic | Unit Test | Integration Test | Status |
|---|---|---|---|
| `investigationStore` | ✅ `investigationStore.test.ts` | ❌ | Ready |
| `workspaceStore` | ✅ `workspaceStore.test.ts` | ❌ | Ready |
| `LogDistributionWidget`| ✅ `LogDistributionWidget.test.tsx` | ❌ | Ready |
| `VirtualLogTable` | ❌ | ❌ | **Critical Gap** |
| `LogToolbar` | ❌ | ❌ | Coverage Gap |
| `useSidecarBridge` | ❌ | ❌ | Coverage Gap |

## 🎯 Target Tasks
- **Implementing `get_health`**: Essential for the sidecar monitoring dashboard.
- **`VirtualLogTable` Tests**: Ensuring virtualization doesn't break log interactivity.
- **Tailing Tests**: Mocking `tail -f` / `ssh` loader to confirm sidecar threading is robust.

## 🧬 Rule-Doc Mapping
Every architectural change defined in `docs/architecture/` must link its corresponding test in this status matrix. If a function is implemented but lacks a test, it MUST be listed here with the "Coverage Gap" status.
