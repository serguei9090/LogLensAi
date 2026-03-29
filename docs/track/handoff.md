# Session Handoff: 2026-03-29 16:50

## 1. Last Action
- **UI Refinement**: Completed the hide-on-toolbar logic for filters and highlights. Both are now managed exclusively in their respective dropdown menus, keeping the `LogToolbar` extremely compact.
- **State Isolation**: Successfully refactored `investigationStore.ts` to implement `FEA-002-ISO`. This isolates filters, highlights, search queries, and logs per logical source ID (tab). When a user switches tabs, `InvestigationPage` triggers `syncActiveSource`, which swaps the entire view context.

## 2. Current Blockers
- **None**: All reported UI state issues (hidden logs due to TZ offsets and state bleeding between files) have been resolved.
- **Performance**: The current source-switching mechanism is purely in-memory. If the user has 50+ sources with huge log arrays, memory usage inside the zustand store should be monitored.

## 3. Contextual Memory
- **Nominal vs UTC**: We explicitly moved away from `toISOString()` in `TimeRangePicker.tsx`, opting for a local `yyyy-MM-ddTHH:mm:ss` (nominal) format. This ensures that a "00:00:00" selection on the calendar matches the exact string in the database without offset shifts.
- **InvestigationStore Architecture**: The store now keeps a `Record<string, SourceState>` map. The top-level state is always "The Active Source's State". Swapping is done via `syncActiveSource`.
- **Lint Reminders**: Cleaned up various SonarQube `readonly` and "unused variable" warnings during the refactor.

## 4. Next Atomic Step
- **MCP Scoping**: The user mentioned "working here for mcp". The next task is to scope out the new MCP requirements and initialize any necessary server/skill folders using the `rule-creator` or `skill-creator`.
- **Verify Tailing**: Confirm that `syncActiveSource` doesn't inadvertently affect the `isTailing` status (currently `isTailing` is still a shared global in the store—check if it should also be isolated).

---
**Project State**: [v2.2-Isolated-Final] - Ready for MCP Engineering.
