# LogLensAi - Current Problems TODO

Grouped tasks based on the current IDE/Lint problems.

## 🔴 Errors (High Priority)

### `src/components/organisms/VirtualLogTable.tsx`
- [x] **L590**: Fix "Object is possibly 'undefined'" error.
- [x] **L892**: Fix `LogLevel` type mismatch (FATAL not assignable to LogLevelBadge LogLevel).

### `src/components/pages/InvestigationPage.tsx`
- [x] **L7**: Export `LogEntry` from `VirtualLogTable` or fix import source. (Fixed by importing from @/types/log)
- [x] **L313**: Use block statements for control structures.
- [x] **L345**: Use block statements for control structures.

---

## 🟡 Warnings & Refactoring (Medium Priority)

### `sidecar/src/api.py`
- [x] **L296, 301, 307**: Remove unused parameter `workspace_id`.
- [x] **L1165**: Remove unused parameter `cursor`.
- [x] **L1199**: Remove commented out code.
- [x] **L1292, 1431**: Specify exception class for `except` blocks.
- [x] **L469, 2233**: Refactor to reduce cognitive complexity.

### `sidecar/src/db.py`
- [x] **L24**: Define a constant for `:memory:` literal.

### `sidecar/src/metadata_extractor.py`
- [x] **L20**: Remove duplicates in character class.
- [ ] **L42, 153**: Refactor to reduce cognitive complexity.

### Complexity & Unused Variables (Sidecar)
- [ ] `sidecar/src/parser.py:L11`: Refactor cognitive complexity.
- [ ] `sidecar/src/services/log_file_store.py:L197`: Refactor cognitive complexity.
- [x] `sidecar/src/workers/clustering.py:L83`: Refactor cognitive complexity.
- [x] `sidecar/tests/test_llql_new.py`: Replace unused `params` with `_`.
- [ ] `sidecar/tests/test_metadata_extractor.py`: Replace unused variables (`ts`, `lvl`, `msg`) with `_`.

### `src/components/` (UI/Frontend)
- [x] `LogToolbar.tsx:L29`: Remove unused import `ZapOff`. (Fixed by Biome)
- [x] `SystemDiagnosticConsole.tsx:L10`: Remove unused import `Bug`. (Fixed by Biome)
- [x] `SystemDiagnosticConsole.tsx:L193-195`: Extract nested ternary.
- [x] `SettingsPanel.tsx:L187-200`: Handle exception properly.
- [x] `Sidebar.tsx:L429`: Refactor cognitive complexity.
- [x] `Sidebar.tsx:L719-735`: Mark props as read-only.

### `src/lib/` & `src/store/`
- [x] `debug-utils.ts:L73, 87`: Use `globalThis` instead of `window`.
- [x] `hooks/useHealthStatus.ts:L11`: Remove useless assignment to `isPolling`.
- [x] `hooks/useIngestionStatus.ts:L4`: Use `export…from` to re-export `IngestionJob`.
- [x] `hooks/useSidecarBridge.ts:L47, 103`: Refactor cognitive complexity and nested ternary.
- [x] `store/workspaceStore.ts:L184, 228, 247, 358`: Refactor nested functions and use optional chaining.
