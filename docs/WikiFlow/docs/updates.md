# [2026-04-24] SettingsPanel.tsx — Biome Compliance Refactor

**Role:** Coder Smith (@frontend)  
**Trigger:** 12 Biome warnings detected by IDE diagnostics  

## Changes Applied
| # | Warning | Fix Applied |
|---|---|---|
| 1-3 | `window` → prefer `globalThis` (L211, 212, 321) | Replaced with `globalThis.addEventListener`, `globalThis.removeEventListener`, `globalThis.location.reload()` |
| 4 | Optional chain preferred (L216) | `!value \|\| !value.key` → `!value?.key` |
| 5 | Cognitive complexity 23 > 15 (L265) | Hoisted `safeParse` and `parseRemote` to module scope as pure, documented functions |
| 6 | `await` of non-Promise void (L355) | Removed `await` from `onSave(settings)` call |
| 7-8 | Unhandled exceptions in catch (L370, L386) | Added `console.error` logging to both catch blocks |
| 9-12 | Nested ternary operations (L795-808) | Extracted `getProviderLabel()` and `getProviderDescription()` pure helpers at module scope |

## Structural Outcome
- `safeParse` — module-level pure function with full JSDoc and `Ref:` link
- `parseRemote` — module-level pure function, decoupled from component closure
- `getProviderLabel` / `getProviderDescription` — module-level pure helpers
- `SettingsPanel` component cognitive complexity reduced below the 15-point threshold

## Verification
- `bunx @biomejs/biome check src/components/organisms/SettingsPanel.tsx` → **0 warnings, 0 errors**
