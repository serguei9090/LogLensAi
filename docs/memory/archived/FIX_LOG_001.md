# FIX-LOG-001: General Code Quality & Linting Overhaul

## Status
- **Type**: Bug Fix / Refactor
- **Priority**: Medium
- **ID**: `FIX-LOG-001`
- **Assigned to**: @antigravity
- **Status**: [x] Completed (2026-04-16)

## Problem Statement
The LogLensAi codebase currently has multiple cumulative linting and quality issues identified by Biome (Frontend) and Ruff (Backend). These include:
- Unnecessary hook dependencies and `any` types in core pages.
- Accessibility (A11y) violations in labels, roles, and event listeners.
- High Cognitive Complexity in rendering and logic modules.
- Python literal duplication and redundant `async` declarations.
- Infrastructure-level best practice violations (e.g., `node:path` vs `path`).

## Proposed Solution
1. **Frontend**:
    - Refactor `InvestigationPage.tsx` and `SettingsPanel.tsx` to align with strict hook dependency rules.
    - Replace `any` types with proper interfaces.
    - Wrap single-line conditionals in blocks.
    - Fix A11y roles and label/input associations.
2. **Backend**:
    - Introduce constants for duplicated literals in `ai.py` and `ollama.py`.
    - Refactor complex functions in `db.py` and `gemini_cli.py` to reduce complexity scores.
    - Clean up redundant `async` keywords.

## Completed Actions (Audit Loop)

### 1. Frontend Refactoring
- **`InvestigationPage.tsx`**: Resolved all hook dependency warnings, replaced `any` types for Anomaly and Cluster data, and added missing block statements.
- **`SettingsPanel.tsx`**: Standardized props as `ReadOnly`, fixed `any` casting for remote settings, and ensured proper `id` association for `SettingSelect` components.
- **`MarkdownContent.tsx`**: Massive refactor of `parseMarkdown` into modular block parsers. Removed fragile array-index keys in favor of stable, contextual identifiers.
- **`WorkspaceTabs.tsx`**: Fixed A11y violation where `role="tab"` elements were non-focusable. Standardized on `button` as the primary tab trigger to avoid interactive role nesting.
- **`Sidebar.tsx`**: Standardized workspace navigation items to use semantic `<button>` elements instead of potentially confusing `role="button"` div wrappers.
- **`ThinkingBlock.tsx`**: Added proper focus-visible styles and removed redundant non-semantic click listeners.
- **`useSidecarBridge.ts`**: Migrated from `window` to `globalThis` for environment detection.
- **`vite.config.ts`**: Updated to use the `node:path` prefix.

### 2. Backend (Sidecar) Cleanup
- **`gemini_cli.py`**: Decomposed the monolithic `_chat_hot` into specialized methods (`_prepare_hot_prompt`, `_parse_sse_stream`) to reduce cognitive complexity.
- **`db.py`**: Modularized `_create_tables` logic into discrete transactional blocks.
- **`ai.py` & `ollama.py`**: Extracted hardcoded model literals into shared `AI_MODELS` and `DEFAULT_MODELS` constants.
- **`api.py`**: Stripped redundant `async` keywords from synchronous DuckDB helper methods.

## Verification
- [x] `bun x @biomejs/biome check src --write` (Auto-fixed 100+ style issues)
- [x] `uv run ruff check sidecar --fix` (Resolved 150+ import and formatting errors)
- [x] Manual verification of Sidecar bridge and Investigation Page rendering.

## Impact Analysis
- **Low Risk**: Most changes are syntactical or structural refactoring.
- **High Reward**: Improved code maintainability, better screen reader support, and cleaner build signatures.
