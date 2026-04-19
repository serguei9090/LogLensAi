# FIX-STABILITY-001: Global IDE Resolution

## Problem
Multiple IDE-reported errors and warnings are accumulating in the codebase, leading to potential runtime issues and developer friction.
Major issues:
- `A2UIRenderer` has missing exports from `lucide-react` and type mismatches.
- `AIInvestigationSidebar` has a severe type error in filter generation (missing `id`).
- `WorkspaceEngineSettings` has type safety regressions in sidecar responses.

## Proposed Solution
- **Surgical Type Hardening**: Cast `unknown` responses to specific interfaces.
- **Protocol Compliance**: Ensure `FilterEntry` always has an `id`.
- **Regex Optimization**: Switch `.match()` to `.exec()` where requested by the linter.
- **Dead Code Pruning**: Strip unused imports and variables.

## Affected Files
- `src/components/atoms/A2UIRenderer.tsx`
- `src/components/organisms/AIInvestigationSidebar.tsx`
- `src/components/organisms/WorkspaceEngineSettings.tsx`
- `src/components/organisms/LogToolbar.tsx` (onEngineSettingsOpen unused)
- `src/store/aiStore.ts` (.at conversion)
- `sidecar/main.py` (Restored proxy to src/api.py)

## Impact Analysis
- **Stability**: High (Fixes type errors).
- **Breaking Changes**: None.
