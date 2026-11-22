# AI Sidebar

## Overview
Investigation AI assistant sidebar package integrating `useAiStore`, `useWorkspaceStore`, `useSettingsStore`, `useInvestigationStore`, and `useUIStore` with sidecar model discovery (`list_ai_models`), drag resizing, session renaming/history search, A2UI action dispatch, and streaming chat UI.

## Interface
- `[AIInvestigationSidebar.tsx:AIInvestigationSidebarProps]` — Props interface declaring optional readonly `onEngineSettingsOpen?: () => void`.
- `[AIInvestigationSidebar.tsx:AIInvestigationSidebar]` — Resizable right-hand AI investigation sidebar container.
- `[index.ts]` — Re-exports `AIInvestigationSidebar`, `type AIInvestigationSidebarProps`, child components (`AIMessageRow`, `MessageContentBubble`, `ModelDropdownMenu`, `SidebarInputBar` and their props types), and utilities (`parseThinking`, `stripChannelTags`, `stripA2UITags`, `OPENROUTER_QUICK_FREE_MODELS`, `AI_COMMANDS`).
- Subdirectories:
  - [components](./components/README.md) — Chat rows, message bubbles, model dropdown submenu, and composer input bar.
  - [utils](./utils/README.md) — Model/command presets and streaming reasoning/A2UI tag parsers.

## Invariants
- `[AIInvestigationSidebar.tsx:AIInvestigationSidebar]` Returns `null` when `isSidebarOpen` is `false`; locks inline width/minWidth/maxWidth to `${sidebarWidth}px`; destructures `onEngineSettingsOpen` as unused `_onEngineSettingsOpen`.
- `[AIInvestigationSidebar.tsx:handleMouseMove]` Constrains drag-resized width (`window.innerWidth - e.clientX`) strictly to `320 < newWidth < 800` before persisting via `setSidebarWidth`.
- `[AIInvestigationSidebar.tsx:fetchModels]` Returns early if no provider is configured or if `!forceRefresh` and `providerModelsCache[currentProvider]` is non-empty; marks verified and caches models only when `list_ai_models` returns a non-empty array.
- `[AIInvestigationSidebar.tsx:handleA2UIAction]` Ignores non-object actions or objects lacking `type`; handles `"filter"` (requires truthy `field` and `value`, defaults `operator` to `"equals"`), `"search"` (requires truthy `query`), and `"add_column"` (requires truthy `label`, defaults `id` to `"col-" + Date.now()`, skips duplicates in `customColumns`).
- `[AIInvestigationSidebar.tsx:generateDefaultName]` & `[AIInvestigationSidebar.tsx:handleSendMessage]` Generates `"LOG-<6-digit>"` pending names when no session exists; `handleSendMessage` aborts if `messageText.trim()` is empty or `activeWorkspace?.id` is missing and includes `session_name` only when creating a new session; `handleRename` ignores whitespace-only titles; empty state displays at most 4 recent sessions (`sessions.slice(0, 4)`) and reveals `AIHistorySearchModal` when `sessions.length > 4`.

## Side Effects
- `[AIInvestigationSidebar.tsx:fetchModels]` Updates `useSettingsStore` (`updateSettings`, `flushPendingSettings`, `markProviderVerified`, `setProviderCachedModels`), calls sidecar RPC `"list_ai_models"` via `callSidecar`, and logs errors via `console.error`.
- `[AIInvestigationSidebar.tsx:AIInvestigationSidebar]` Fetches sessions (`fetchSessions`) and settings (`fetchSettings`) on open/workspace changes; auto-scrolls via `scrollRef.current.scrollIntoView`; mutates `useAiStore`, `useSettingsStore`, `useInvestigationStore`, and `useUIStore`; logs unknown A2UI actions via `console.warn`; attaches/removes `document` `"mousemove"` and `"mouseup"` listeners and mutates `document.body.style.cursor` during sidebar resizing.

## Verification
- Run: `bun test`
