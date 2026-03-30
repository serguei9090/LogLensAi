# LogLensAi: Lessons Learned & Post-Mortem Log

This document tracks identified bugs, root causes, and their permanent fixes to prevent regression and ensure faster resolution in future development cycles.

| Date | Bug Description | Root Cause | Solution/Fix | Agent |
| :--- | :--- | :--- | :--- | :--- |
| 2026-03-24 | DuckDB WAL Lock | Improper `aiohttp` cleanup on Ctrl+C | Implemented `on_cleanup` hook to reset DB | @jules |
| 2026-03-25 | Workspace Duplication | Frontend race condition on init | Added Zustand `isInitializing` flag | @engineer |
| 2026-03-29 | DuckDB Binder Error | SQL Alias mismatch in count_query | Consistent table aliasing with 'l' in all log fetch paths | @jules |
| 2026-03-30 | Base UI Tooltip Typos | Using Radix-style props (delayDuration/asChild) on Base UI components | Reverted to `delay` and native element wrapping | @antigravity |
| 2026-03-30 | Log Multi-Select Toggle Over-active | Standard mouse click `toggleLogSelection` logic was additive | Implemented standard click replacement with only clicked ID; reserved toggle for Ctrl/Meta keys | @antigravity |
| 2026-03-30 | Note Panel UX Conflict | Expanded note panel was too large (redundant raw data) and overlapped with AI Batch pill | Refactored Note UI to single-column, removed raw data, and silenced AI pill when expandedRow is active | @antigravity |
