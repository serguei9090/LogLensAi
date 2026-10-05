---
trigger: always_on
description: Evidence stack for Beads, Codanna, local repository inspection, documentation review, and synthesis.
---

# Intelligence Stack (LogLensAi)

Use the smallest evidence stack that makes the task safe and fast.

## Layers

| Layer | Purpose | Tools |
| --- | --- | --- |
| **Task State** | Track tasks & detailed specifications | Markdown tracking in `docs/track/TODO.md` & `docs/track/specs/<ID>.md` |
| **Physical Code Truth** | Find definitions, callers, callees, and blast radius in <1s | `codanna retrieve symbol/callers/calls`, `codanna mcp analyze_impact` |
| **Surgical Code View** | Read and edit internal logic of identified lines | Targeted file view on exact lines (no full-repo dumps) |
| **Verification** | Ensure zero regressions & strict reachability | `go test ./...`, `flutter test`, `flutter analyze` |

## Optimal Workflow: Codanna First, Surgical Read Second

1. **Locate with Codanna**: Before opening files, locate symbol definitions and callers using Codanna:
   ```powershell
   codanna retrieve symbol <Name>
   codanna retrieve callers <Name>
   codanna mcp analyze_impact <Name>
   ```
2. **Surgical Read**: Once Codanna provides the exact file path and line numbers, open ONLY those targeted lines to view or edit the function body.
3. **Never Brute-Force Grep**: Avoid full-text grep scans across the repository for call hierarchies. Grep generates false positives from comments, tests, and strings; Codanna queries the true AST.
4. **Re-index on Structural Change**: Run `codanna index .` when adding or renaming exported symbols.

