# Changelog: LogLensAi

All notable changes to this project will be documented in this file.

## [Phase 0] - Antigravity Genesis (2026-03-21)
### Added
- **Project Structure**: Created Atomic Design directories (`src/components/...`).
- **AI Cortex**: Defined `.agents/rules` for Architecture, Quality, and Software Standards.
- **Workflow Autonomy**: Established `/jules-loop` for automated TDD/Code generation.
- **Subagent Fleet**: Created profiles for `@lint-agent`, `@doc-agent`, `@reviewer-agent`, and `@jules-agent`.
- **Infrastructure Specs**: Drafted `docs/PRD.md` and `docs/API_SPEC.md`.
- **Lefthook Integration**: Background terminal execution for subagents on git hooks.
- **Initial UI Design**: Stitch project generated for Overview and Deep Dive views.

## [Phase 3] - AI Reasoning & UX Stabilization (2026-04-16)
### Added
- **Ollama Reasoning Pipeline**: Field-aware, multi-marker stream parser for Gemma4 reasoning mode.
- **Environment Controls**: Surgical debug toggles (LOGLENS_DEBUG, LOGLENS_AI_DEBUG) via .env.
- **Reactive Chat UI**: Auto-scrolling logic that tracks token streaming and preserves session focus.
- **Documentation**: New architecture docs for AI Parsing (docs/architecture/ai_parsing.md).

### Fixed
- **Stream Fragmentation**: Resolved reasoning token leakage into final responses by prioritizing native JSON fields.
- **Context Hygiene**: Standardized history management to strip internal thought blocks before multi-turn inference.
- **NameError Regression**: Restored missing os import in Ollama provider.
- **UI Focus**: Fixed 'dead view' issue where long sessions loaded at the top instead of the last answer.
- **UI Refactor**: Enhanced 'Think' toggle with text and brighter aesthetic; removed redundant footer tags and trash button.
- **UX Regression Fix**: Restored missing Trash2 icon in History dropdown.

## [Phase 4] - Go Backend Migration & Laya System 1 Triage (2026-10-09)
### Added
- **Go Sidecar Engine**: Fully replaced Python backend with Go 1.26 sidecar (`marcboeker/go-duckdb`) handling >81k lines/sec ingestion and Drain3 mining.
- **Laya System 1 Triage**: Zero-VRAM CPU/DirectML ONNX ModernBERT-large classifier (`nvkudva/laya-web-q8`) providing sub-30ms cluster severity and outage detection.
- **Rule Evolution**: Checkpointed prompt and rubric manager with JSON/Visual editors and 1-click snapshot rollback.
- **A2UI Studio & Insights**: Dynamic AI Insights mode with declarative blueprint visualizers, timeline density charts, and metric observation cards.

## [Phase 5] - RAG Memory Pre-Check & Exhaustive Test Suite (2026-10-13)
### Added
- **Automatic RAG Cluster Memory Check**: Wired into `AnalyzeCluster` to compare cluster templates against DuckDB-VSS incident memory with cosine similarity clamping.
- **Diagnostic Badges**: Automatic classification tagging (`🟡 KNOWN ISSUE` with prior resolution vs `🔴 NEW ANOMALY` for first-time occurrences) in `DiagnosticSidebar`.
- **Exhaustive Testing Pipeline**:
  - Full Playwright E2E suite covering 20/20 tests across all modals, builders, visualizers, drawers, and settings.
  - Automated 3-version snapshot retention pruning.
  - 12 Vitest suites (51 tests) covering state stores, shortcuts, and typed JSON-RPC 2.0 schemas.
  - Go unit and benchmark tests across DB, AI, Drain3, and RPC handlers.
### Changed
- **DOM Accessibility**: Refactored `ClusterRow` to eliminate nested interactive elements and resolve React event bubbling warnings.
- **Workspace Hygiene**: Cleaned up deprecated Python artifacts and stale logs from the root directory.
