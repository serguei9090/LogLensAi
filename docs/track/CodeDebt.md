# Code Debt Tracking

Track all technical debt, known bugs, and refactoring needs here.

# Code Debt Tracking

Track all technical debt, known bugs, and refactoring needs here.

## Known Issues
- None

## Refactoring Targets
- None

## FUSION-DEBT
- [ ] **FUSION-DEBT-01: Timezone Clock Drift Compensation**. Currently we only support manual offset. Future: automatic drift detection based on shared known events.

## AI-DEBT
- [x] **AI-DEBT-01: Subprocess Bottleneck**. `GeminiCLIProvider` now uses `asyncio.create_subprocess_exec` ensuring non-blocking execution.
- [x] **AI-DEBT-02: Selection Conflict Mitigation**. `VirtualLogTable` successfully integrates "Map Field" text-range extraction without interfering with row selection logic.
- [x] **AI-DEBT-03: Chat Response Streaming**. Implemented SSE (Server-Sent Events) protocol for real-time token streaming in `api.py`.
- [x] **AI-DEBT-04: Provider-Specific Temp File Dependency**. Standardized on **Universal Auto-Healing** (Context Injection) in the sidecar to eliminate dependence on Gemini CLI / A2A server's internal temp folders.
