# AI Investigation Sidebar

## Overview
Resizable right-hand AI investigation assistant sidebar for the Investigation workspace, managing active chat sessions, provider/model switching, streaming thought parsing, A2UI action dispatch, and session history navigation.

## Interface
- `[index.ts:AIInvestigationSidebar]` - Re-exports `AIInvestigationSidebar` from `./AIInvestigationSidebar`.
- `[index.ts:AIInvestigationSidebarProps]` - Re-exports type `AIInvestigationSidebarProps` from `./AIInvestigationSidebar`.
- `[index.ts:AIMessageRow]` - Re-exports `AIMessageRow` from `./components/AIMessageRow`.
- `[index.ts:AIMessageRowProps]` - Re-exports type `AIMessageRowProps` from `./components/AIMessageRow`.
- `[index.ts:MessageContentBubble]` - Re-exports `MessageContentBubble` from `./components/MessageContentBubble`.
- `[index.ts:MessageContentBubbleProps]` - Re-exports type `MessageContentBubbleProps` from `./components/MessageContentBubble`.
- `[index.ts:ModelDropdownMenu]` - Re-exports `ModelDropdownMenu` from `./components/ModelDropdownMenu`.
- `[index.ts:ModelDropdownMenuProps]` - Re-exports type `ModelDropdownMenuProps` from `./components/ModelDropdownMenu`.
- `[index.ts:SidebarInputBar]` - Re-exports `SidebarInputBar` from `./components/SidebarInputBar`.
- `[index.ts:SidebarInputBarProps]` - Re-exports type `SidebarInputBarProps` from `./components/SidebarInputBar`.
- `[index.ts:parseThinking]` - Re-exports `parseThinking` from `./utils/parseThinking`.
- `[index.ts:stripChannelTags]` - Re-exports `stripChannelTags` from `./utils/parseThinking`.
- `[index.ts:stripA2UITags]` - Re-exports `stripA2UITags` from `./utils/parseThinking`.
- `[index.ts:OPENROUTER_QUICK_FREE_MODELS]` - Re-exports `OPENROUTER_QUICK_FREE_MODELS` from `./utils/models`.
- `[index.ts:AI_COMMANDS]` - Re-exports `AI_COMMANDS` from `./utils/models`.
- `[AIInvestigationSidebar.tsx:AIInvestigationSidebarProps]` - Exported interface `{ readonly onEngineSettingsOpen?: () => void }`.
- `[AIInvestigationSidebar.tsx:AIInvestigationSidebar]` - Exported React component rendering the resizable investigation chat panel or `null` when closed.
- Child contracts: [components](./components/README.md), [utils](./utils/README.md).

## Invariants
- `[AIInvestigationSidebar.tsx:AIInvestigationSidebar]` Returns `null` when `useAiStore().isSidebarOpen` is false; when open, locks root `width`, `minWidth`, and `maxWidth` to `${sidebarWidth}px`.
- `[AIInvestigationSidebar.tsx:AIInvestigationSidebar]` `fetchModels` aborts when `currentProvider` is falsy or cached models exist without `forceRefresh`, flushes `ai_provider` settings before calling `list_ai_models`, updates verified/cached models only for non-empty array results, and always clears `isFetchingModels` in `finally`.
- `[AIInvestigationSidebar.tsx:AIInvestigationSidebar]` `handleA2UIAction` guards non-object/untyped payloads and supports `"filter"`, `"search"`, and `"add_column"` (deduplicating `customColumns` by ID); `displayTitle` falls back from `currentSession?.name` to `'LOG-' + 6-digit` `pendingSessionName` to `'Investigation Hub'`.
- `[AIInvestigationSidebar.tsx:AIInvestigationSidebar]` `handleSendMessage` requires non-empty `messageText.trim()` and `activeWorkspace?.id`, clears selected logs only if `selectedLogIds.length > 0`, and passes `pendingSessionName` only when starting a new session; `handleMouseMove` constrains resize width strictly to `(320, 800)` px; empty message view caps recent sessions at `sessions.slice(0, 4)`; prop `onEngineSettingsOpen` is unused (`_onEngineSettingsOpen`).

## Side Effects
- `[AIInvestigationSidebar.tsx:AIInvestigationSidebar]` Calls sidecar RPC `list_ai_models`, mutates `useAiStore`, `useSettingsStore`, `useInvestigationStore`, and `useUIStore`, triggers `scrollRef.current.scrollIntoView`, registers/removes `document` `'mousemove'` and `'mouseup'` drag listeners while mutating `document.body.style.cursor`, reads `window.innerWidth`, generates random default session IDs via `Math.random()`, and logs errors/warnings to `console`.

## Verification
- Run: `bun test`
