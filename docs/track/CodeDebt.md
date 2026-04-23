# Code Debt Tracking

Track all technical debt, known bugs, and refactoring needs here.

> 📊 Last audited: 2026-04-23 — Full analysis in [project-report-2026-04-23.md](../project-report-2026-04-23.md) § 4

## Known Issues

- [x] **HIER-DEBT-01: `delete_folder` cascade re-parenting**. Resolved by re-parenting children to root before parent deletion. See `docs/TODOC/FIX-HIER-001.md`.

## Refactoring Targets

- [x] **COMPLEXITY-DEBT-01: `extract_log_metadata()` cyclomatic complexity 39**. Decomposed into focused sub-extractors. See `docs/TODOC/REFACTOR-META-001.md`.
- [x] **COMPLEXITY-DEBT-02: `AIStudioProvider.chat_stream()` complexity 18**. Extracted helper functions. See `docs/TODOC/REFACTOR-AI-STUDIO-001.md`.
- [x] **DEBUG-DEBT-01: `print()` statements in `openai_compatible.py`**. Replaced with `logger.debug()`. See `docs/TODOC/FIX-DEBT-001.md`.
- [ ] **COMPLEXITY-DEBT-03: `ingestion.py:_run_http` complexity 14**. Needs decomposition of routing and validation logic.
- [ ] **COMPLEXITY-DEBT-04: `query_parser.py:parse_primary` complexity 14**. Evaluate separating parsing logic by operator.
- [ ] **OCP-DEBT-01: `api.py:194` hardcoded provider if-chains**. Open/Closed Principle violation; should use a dynamic factory or registry pattern.

## FUSION-DEBT

- [ ] **FUSION-DEBT-01: Timezone Clock Drift Compensation**. Currently we only support manual offset. Future: automatic drift detection based on shared known events. See `docs/TODOC/FUSION-DEBT-01.md`.

## AI-DEBT

- [x] **AI-DEBT-01: Subprocess Bottleneck**. `GeminiCLIProvider` now uses `asyncio.create_subprocess_exec` ensuring non-blocking execution.
- [x] **AI-DEBT-02: Selection Conflict Mitigation**. `VirtualLogTable` successfully integrates "Map Field" text-range extraction without interfering with row selection logic.
- [x] **AI-DEBT-03: Chat Response Streaming**. Implemented SSE (Server-Sent Events) protocol for real-time token streaming in `api.py`.
- [x] **AI-DEBT-04: Provider-Specific Temp File Dependency**. Standardized on **Universal Auto-Healing** (Context Injection) in the sidecar to eliminate dependence on Gemini CLI / A2A server's internal temp folders.
