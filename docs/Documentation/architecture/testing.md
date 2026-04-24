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
| `method_get_fused_logs` | ✅ `test_fusion.py` | ✅ | Ready (New: `PARS-004`) |
| `method_ingest_logs` | ✅ `test_api_methods.py` | ✅ `test_e2e_ingestion.py` | Ready |
| `method_get_log_distribution`| ✅ `test_api_methods.py` | ✅ | Ready |
| `method_get_anomalies` | ✅ `test_anomalies.py` | ❌ | Ready |
| `method_update_log_comment` | ✅ `test_api_methods.py` | ❌ | Ready |
| `method_analyze_cluster`| ✅ `test_api_methods.py` | ❌ | Ready (Mocked) |
| `method_send_ai_message`| ✅ `test_ai_persistence.py` | ❌ | Ready (Hot Mode taskId) |
| `method_get_settings` | ✅ `test_api_methods.py` | ✅ | Ready |
| `method_update_settings` | ✅ `test_api_methods.py` | ✅ | Ready |
| `AIProvider (Logic)` | ✅ `test_ai_providers.py` | ❌ | Ready (Providers) |
| `Metadata Extraction` | ✅ `test_metadata.py` | ❌ | Ready |
| `HybridRunner (Logic)` | ✅ `test_hybrid_orchestration.py` | ❌ | Ready |
| `GraphManager (Logic)` | ✅ `test_hybrid_orchestration.py` | ❌ | Ready |
| `ToolRegistry (Logic)` | ✅ `test_hybrid_orchestration.py` | ❌ | Ready |
| `ReasoningParser (Logic)`| ✅ `test_thinking_parser.py` | ❌ | Ready |
| `method_get_health` | ✅ `test_tailing.py` | ❌ | Ready |
| `method_start_tail` | ✅ `test_tailing.py` | ❌ | Ready |
| `method_stop_tail` | ✅ `test_tailing.py` | ❌ | Ready |
| `AIStudioProvider` | ✅ `test_ai_studio.py` | ❌ | Ready |
| `OpenAICompatibleProvider` | ✅ `test_openai_provider.py` | ❌ | Ready |
| `SSHLoader` | ✅ `test_ssh.py` | ❌ | Ready |

## 📊 Coverage Matrix (Frontend React)

| Component / Logic | Unit Test | Integration Test | Status |
|---|---|---|---|
| `investigationStore` | ✅ `investigationStore.test.ts` | ❌ | Ready |
| `workspaceStore` | ✅ `workspaceStore.test.ts` | ❌ | Ready |
| `LogDistributionWidget`| ✅ `LogDistributionWidget.test.tsx` | ❌ | Ready |
| `VirtualLogTable` | ✅ `VirtualLogTable.test.tsx` | ❌ | Ready |
| `LogToolbar` | ❌ | ❌ | Coverage Gap |
| `useSidecarBridge` | ❌ | ❌ | Coverage Gap |

## 📊 Coverage Summary (2026-04-23)
- **Total Backend Coverage**: 68%
- **AI Module Coverage**: 98%
- **Target**: 80%+

## 🎯 Target Tasks
- **VirtualLogTable Tests**: Ensuring virtualization doesn't break log interactivity.

## 🧬 Rule-Doc Mapping
Every architectural change defined in `docs/architecture/` must link its corresponding test in this status matrix. If a function is implemented but lacks a test, it MUST be listed here with the "Coverage Gap" status.
