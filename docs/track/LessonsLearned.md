# LogLensAi: Lessons Learned & Post-Mortem Log

This document tracks identified bugs, root causes, and their permanent fixes to prevent regression and ensure faster resolution in future development cycles.

| Date | Bug Description | Root Cause | Solution/Fix | Agent |
| :--- | :--- | :--- | :--- | :--- |
| 2026-03-24 | DuckDB WAL Lock | Improper `aiohttp` cleanup on Ctrl+C | Implemented `on_cleanup` hook to reset DB | @jules |
| 2026-03-25 | Workspace Duplication | Frontend race condition on init | Added Zustand `isInitializing` flag | @engineer |
| 2026-03-29 | DuckDB Binder Error | SQL Alias mismatch in count_query | Consistent table aliasing with 'l' in all log fetch paths | @jules |
