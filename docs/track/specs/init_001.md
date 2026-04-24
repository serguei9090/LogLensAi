# TODO: init_001
**Title:** Initialize Tauri v2 Workspace & React Frontend
**Status:** Pending

### The Contract (What)
We need the physical directory structure for the frontend desktop application.

### The Rationale (Why)
A blank canvas is required before any atomic UI or bridge components can be built. We strictly mandate Tauri v2 with Bun and React 19 to align with `SoftwareStandards.md`.

### Execution Steps for the Subagent
1. Run `bun create tauri-app@latest .` (Using non-interactive flags or `yes` to accept defaults).
2. Configure it to use `React`, `TypeScript`, and `Bun`.
3. Wipe the default `src/App.tsx` and place a blank "LogLensAi Genesis" `<div/>` as a placeholder.
4. Do NOT install shadcn or Tailwind yet (That is a separate isolated task).

### Definition of Done
Tauri build compiles locally (`bun run tauri build` success) and no linter errors.
