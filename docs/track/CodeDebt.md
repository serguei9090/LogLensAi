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
- [ ] **AI-DEBT-01: Subprocess Bottleneck**. `GeminiCLIProvider` uses synchronous `subprocess.run`. High concurrency will block the Python Event Loop.
- [ ] **AI-DEBT-02: Selection Conflict Mitigation**. `VirtualLogTable` refactoring must maintain high accuracy for "Map Field" text-range extraction while shifting from row-click-toggle to row-click-select.
- [ ] **AI-DEBT-03: Chat Response Streaming**. Current JSON-RPC implementation lacks chunked streaming responses. Resulting in "Wait and Blink" UX rather than live typing.
- [x] **AI-DEBT-04: Provider-Specific Temp File Dependency**. Standardized on **Universal Auto-Healing** (Context Injection) in the sidecar to eliminate dependence on Gemini CLI / A2A server's internal temp folders.
