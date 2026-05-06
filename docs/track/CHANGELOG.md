# Changelog

This changelog archives changes prior to Phase 7. For historical context, please refer to CHANGELOG.md.bak.

## [Phase 6.2] - Agentic Framework Standardization & Audit Protocol (2026-04-24)

### Added
- **Audit Smith (@audit) Persona**: 
    - Formally established the "Master of Architectural Compliance" role in `agents.md`.
    - Added 11+ missing subagent profiles in `.gemini/agents/` to ensure full persona-to-execution parity.
- **Unified Audit Infrastructure**:
    - Centralized all oversight workflows into a new `.agents/workflows/audits/` directory.
    - Transitioned nomenclature from generic "Reports" to active "Audits" (e.g., `project-audit.md`, `quality-audit.md`).
    - Implemented `ai-audit.md` for specialized framework health checks.
- **Semantic Commenting Standards**:
    - Mandated `Ref: <spec>` links in function docstrings for better architectural traceability.
    - Enforced a strict `// TODO(ID): [WHAT] [WHY] [EXPECTATION] [CONTEXT]` syntax to link code to spec files.
- **Workflow Role Alignment**: Standardized all 44+ workflow files with formal `@handle` persona headers and injected mandatory quality standards blocks.

### Refactored
- **Skill Modularization**: Refactored all flat markdown skills in `.agents/skills/` into modular folders with standard `SKILL.md` files.
- **Orchestrator Synchronization**: Updated `commander.md` with the latest model (gemini-2.0-flash), enriched toolkits (audit, telemetry), and aligned instructions with the WikiFlow state machine.

## [Phase 6.1] - Advanced Shortcut Customization & UX Stabilization (2026-04-23)

### Added
- **Multi-Key Shortcut Customization**:
    - Implemented a structured `KeyboardShortcut` object in `settingsStore.ts` to support combinations of Ctrl, Alt, Shift, and Win/Cmd.
    - Added a robust `ShortcutCapture` component in the `SettingsPanel` with a recording mode for easy rebinding.
    - Enhanced the `useKeyboardShortcuts` hook for precise exact-match filtering of modifier keys.
