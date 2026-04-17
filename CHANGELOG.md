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
