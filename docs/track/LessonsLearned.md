# LogLensAi: Lessons Learned & Post-Mortem Log

This document tracks identified bugs, root causes, and their permanent fixes to prevent regression and ensure faster resolution in future development cycles.

| Date | Bug Description | Root Cause | Solution/Fix | Agent |
| :--- | :--- | :--- | :--- | :--- |
| 2026-04-16 | UI Parse Crash & Icon 404 | Duplicate `lucide-react` imports and absent Vite generic favicon | Cleared import duplication and added empty data URI favicon link to index.html | @antigravity |
| 2026-03-24 | DuckDB WAL Lock | Improper `aiohttp` cleanup on Ctrl+C | Implemented `on_cleanup` hook to reset DB | @jules |
| 2026-03-25 | Workspace Duplication | Frontend race condition on init | Added Zustand `isInitializing` flag | @engineer |
| 2026-03-29 | DuckDB Binder Error | SQL Alias mismatch in count_query | Consistent table aliasing with 'l' in all log fetch paths | @jules |
| 2026-03-30 | Base UI Tooltip Typos | Using Radix-style props (delayDuration/asChild) on Base UI components | Reverted to `delay` and native element wrapping | @antigravity |
| 2026-03-30 | Log Multi-Select Toggle Over-active | Standard mouse click `toggleLogSelection` logic was additive | Implemented standard click replacement with only clicked ID; reserved toggle for Ctrl/Meta keys | @antigravity |
| 2026-03-30 | Note Panel UX Conflict | Expanded note panel was too large (redundant raw data) and overlapped with AI Batch pill | Refactored Note UI to single-column, removed raw data, and silenced AI pill when expandedRow is active | @antigravity |
| 2026-03-30 | AI Session Hub Fragmentation | AI icons were generic entry-points with no awareness of past conversations or session naming | Implemented `get_ai_mapping` to highlight explored logs and added VS Code-style dashboard with inline renaming | @antigravity |
| 2026-03-30 | Sidecar Coroutine Never Awaited | App.dispatch was running async handlers but not awaiting them | Refactored sidecar to handle async/await in the API dispatcher for AI methods | @antigravity |
| 2026-03-30 | React Hydration Mismatch | Whitespace and comments between <tr> and <td> in VirtualLogTable | Minified table row contents to prevent text-node mismatches during hydration | @antigravity |
| 2026-03-30 | Nested Button DOM Error | TooltipTrigger was wrapping an interactive sidebar item directly | Implemented conditional tooltips (only when collapsed) to avoid button-in-button hydration errors | @antigravity |
| 2026-03-30 | AI Session Persistence Gap | Missing `commit()` in stateful sidecar methods | Explicitly added `self.db.commit()` to all insert/update RPC methods | @antigravity |
| 2026-03-30 | AI Multi-turn History Loss | Provider only sent the latest message from the history list | Refactored `AIStudioProvider` to reconstruct the full ADK conversation context | @antigravity |
| 2026-03-30 | Sidebar Hydration Violation | Nested interactive triggers (button-in-button) in AI Sidebar | Standardized on single-element triggers (no `asChild` in Base UI) | @antigravity |
| 2026-03-30 | Blocking LLM Sidecar Calls | Log analysis used `subprocess.run` (sync) in async functions | Replaced with `asyncio.create_subprocess_exec` for non-blocking execution | @antigravity |
| 2026-03-30 | Sidebar Accessibility Debt | Extensive use of `role="button"` on `div` elements hindered navigation | Standardized on native `<button>` elements with `tabIndex` and `disabled` support | @antigravity |
| 2026-03-30 | Nested Ternary Toxicity | Complex conditional rendering logic triggered lint warnings and reduced readability | Flattened logic into state-driven JSX variables in `Sidebar.tsx` | @antigravity |
| 2026-03-30 | Gemini CLI Headless Format | Lack of official `-o json` flags and schema awareness (`response` key) | Documented and implemented explicit headless mode with output parsing | @antigravity |
| 2026-03-31 | AI Hot Mode Session Loss | Gemini A2A taskId was stored in-memory only in the sidecar | Implemented `provider_session_id` in DuckDB's `ai_sessions` table to allow Hot Mode resume across app restarts | @antigravity |
| 2026-04-01 | A2A Server 500 Error | Presence of redundant `messageId` field in JSON-RPC payload | Aligned `gemini_cli.py` payload to match user's working `chat_session.js` exactly | @antigravity |
| 2026-04-01 | AI Context Loss on Server Restart | A2A and AI Studio sessions are transient and lost on task expiration | Implemented **Universal Auto-Healing** (Context Injection) using DuckDB as truth | @antigravity |
| 2026-04-01 | Gemini CLI Fallback NameError | Missing `import sys` in `gemini_cli.py` during error logging | Added missing import and standardized log output | @antigravity |
| 2026-04-02 | Gemini Sidecar 500 (JSON) | DuckDB datetimes are not JSON serializable | Explicitly stringify all timestamp fields before RPC return | @antigravity |
| 2026-04-02 | Sidebar Hydration Error | Nested <button> within workspace item in Sidebar.tsx | Replaced outer button with <div role="button"> to allow inner Edit/Delete buttons | @antigravity |
| 2026-04-02 | Sidecar Settings Desync | AI Provider not re-initialized with saved model on startup | Updated App constructor to load current ai_model from DB before creating the AI factory | @antigravity |
| 2026-04-16 | AI Streaming & Thinking Loss | Lack of chat_stream in Ollama and premature collapse of thinking blocks | Implemented Ollama streaming, refined unclosed <think> tag parsing, and added 2s retraction delay | @antigravity |
| 2026-04-16 | UI Wait Latency Gap | No visual feedback between 'Send' and first streaming token | Implemented TypingIndicator and 	hinking… status label to trigger immediately on send | @antigravity |
| 2026-04-16 | Chat Auto-Scroll Failure | `scrollIntoView` was not reactive to message content updates | Implemented `scrollIntoView` dependency on `[messages.length, lastMessage.content]` | @antigravity |
|   2 0 2 6 - 0 4 - 1 6   |   R e a c t   K e y   &   P r o p   L i n t   D r i f t   |   R a p i d   p r o t o t y p i n g   l e d   t o   u s e   o f   a r r a y   i n d e x   a s   k e y s   a n d   n o n - n u l l   a s s e r t i o n s   |   E n f o r c e   s t r i c t   B i o m e   r u l e s   i n   C I   a n d   p r i o r i t i z e   A t o m i c   D e s i g n   p r o p - t y p i n g   o v e r     n y .   |   @ a n t i g r a v i t y   | 
 
 | 2026-04-16 | AI Reasoning Output Fragmentation | Gemma4 uses inline channel markers in content field (not native thinking fields); system prompt injected echo-pollution tags; frontend parser only handled first tag occurrence | 3-layer fix: stateful stream parser in ollama.py converts channel markers to clean think/text blocks, removed broken tag injection from system prompt, frontend parser defensively strips all channel markers | @antigravity |
| 2026-04-16 | Import Regression from Lint Cleanup | Automated Ruff cleanup removed AIChatMessage from ai/__init__.py because it was not used within the package, despite being a public export for the API. | Restored import in __init__.py and implemented __all__ to explicitly define the public interface, preventing future automated pruning of exported symbols. | @antigravity |
| 2026-04-16 | Ollama Pre-parsing Logic Conflict | Stateful parser hung in THOUGHT phase because it was looking for character markers (e.g. <|channel>text) while Ollama had already switched to a native 'content' JSON field without markers. | Implemented a Field-Aware Multi-Marker parser that automatically transitions phases when the JSON field type switches (e.g., from 'thinking' to 'content'), using markers only as a legacy fallback. | @antigravity |
| 2026-04-16 | Missing 'os' Import in Ollama | Regressed during ENV stabilization; `os.getenv` was called without `os` module import. | Added `import os` to `sidecar/src/ai/ollama.py`. | @antigravity |
| 2026-04-16 | Undefined Icon Reference (Trash2) | Removed `Trash2` import during footer refactor while it was still active in the History menu. | Restored `Trash2` import in `AIInvestigationSidebar.tsx`. | @antigravity |
| 2026-04-16 | AI Navigation & Search Modal | Implemented global AI trigger, history truncation (4 items), and a centralized search modal for investigation history. | Added `AIHistorySearchModal.tsx`, updated `LogToolbar.tsx` and `AIInvestigationSidebar.tsx`. | @antigravity |
| 2026-04-17 | Redundant AI Sidebar History Menu | "Recent Investigations" list and "Investigation History" dropdown menu provided duplicate entry points with inconsistent UI patterns | Removed redundant Clock icon dropdown, added "Show more" button to the primary list, and migrated the search modal trigger | @antigravity |

