# AI Sidebar Components

## Overview
Presentational and interactive chat UI subcomponents for the AI investigation sidebar, handling message bubbles, reasoning/A2UI block display, provider/model selection menus, and prompt input with slash commands and log context pills.

## Interface
- `[AIMessageRow.tsx:AIMessageRowProps]` - Exported interface specifying `message`, `prevMessage`, `isLoading`, `isLastMessage`, and `onA2UIAction`.
- `[AIMessageRow.tsx:AIMessageRow]` - Exported React component rendering user/assistant message rows with avatar grouping, attached `context_logs` pill, `MessageContentBubble`, active investigation indicator, and UTC-normalized timestamp.
- `[MessageContentBubble.tsx:MessageContentBubbleProps]` - Exported interface specifying bubble display flags, `thinking`, `content`, `response`, `a2uiPayload?`, `evaluationNotice?`, `steps?`, and `onA2UIAction`.
- `[MessageContentBubble.tsx:MessageContentBubble]` - Exported React component rendering hover copy controls, typing indicator, execution step cards, `evaluationNotice`, `ThinkingBlock`, `MarkdownContent`, and `A2UIRenderer`.
- `[ModelDropdownMenu.tsx:ModelDropdownMenuProps]` - Exported interface specifying provider/model state, cached model lists, provider configs, and selection/fetch callbacks.
- `[ModelDropdownMenu.tsx:ModelDropdownMenu]` - Exported React component rendering the provider/model selector dropdown with configuration guards, OpenRouter quick-free presets, search filtering, and model refresh actions.
- `[SidebarInputBar.tsx:SidebarInputBarProps]` - Exported interface specifying input bar state, `selectedLogIds`, provider/model/reasoning props, and submission/cancellation callbacks.
- `[SidebarInputBar.tsx:SidebarInputBar]` - Exported React component rendering the chat composer with slash-command autocomplete, log context badge, `Textarea`, `ModelDropdownMenu`, reasoning toggle, and send/stop controls.

## Invariants
- `[AIMessageRow.tsx:AIMessageRow]` Bypasses `parseThinking` for `message.role === "user"` (`thinking = null`, `response = message.content`, `isStreamingThink = false`); uses `parseThinking(message.content)` for assistant messages.
- `[AIMessageRow.tsx:AIMessageRow]` `showTypingIndicator` requires `!isUser && !thinking && !response && isLoading && isLastMessage`; `isPulseActive` requires `isStreamingThink && isLoading && isLastMessage`; the investigating indicator requires `!isUser && isLoading && isLastMessage && !showTypingIndicator`.
- `[AIMessageRow.tsx:AIMessageRow]` Consecutive messages with `prevMessage?.role === message.role` hide the avatar and omit the timestamp; visible timestamps without trailing `Z`, `+`, or `-` after index 10 are normalized with `T` and `Z` before `Date` formatting.
- `[MessageContentBubble.tsx:MessageContentBubble]` Hides the copy button while `showTypingIndicator` is true and copies `content` (user) or `response` (assistant); renders `evaluationNotice`, `ThinkingBlock` (when `thinking !== null || isPulseActive`), execution steps, `MarkdownContent`, and `A2UIRenderer` only when `!isUser && !showTypingIndicator`.
- `[MessageContentBubble.tsx:MessageContentBubble]` Falls back `MarkdownContent` text for non-user messages with falsy `response` to `"Completed multi-step investigation."` when `steps?.length > 0`, otherwise `"No response content received."`.
- `[ModelDropdownMenu.tsx:ModelDropdownMenu]` Renders unconfigured providers (`!provider.isConfigured`) as non-interactive rows without a submenu (`"openai-compatible"` requires either a non-default `openaiHost` or `openaiCompatKey`).
- `[ModelDropdownMenu.tsx:ModelDropdownMenu]` Resets `modelSearchQuery` to `""` when a submenu closes, renders the model search input only when `rawModels.length > 7`, disables refresh/fetch controls while `isFetchingModels` is true, and invokes `onProviderChange(provider.id)` alongside cross-provider model selection or fetch actions.
- `[SidebarInputBar.tsx:SidebarInputBar]` Disables Send and ignores `handleSend` when `!inputValue.trim()`, swaps Send for Stop (`onStopStream`) while `isLoading` is true, opens slash commands iff input starts with `"/"` (filtered by `c.cmd.startsWith(inputValue.toLowerCase())`), clears context via `onClearSelection()` on Backspace when `inputValue === "" && selectedLogIds.length > 0`, and submits on Enter without Shift.

## Side Effects
- `[MessageContentBubble.tsx:MessageContentBubble]` Writes message text to `navigator.clipboard.writeText(...)` and schedules a 2000 ms `setTimeout` (without unmount cleanup) to reset `copied` state.
- `[ModelDropdownMenu.tsx:ModelDropdownMenu]` Calls `e.stopPropagation()` on nested menu triggers/inputs and dispatches provider, model, and fetch callbacks.
- `[SidebarInputBar.tsx:SidebarInputBar]` Focuses the DOM textarea via `textareaRef.current?.focus()` on slash-command selection, calls `e.preventDefault()` on unshifted Enter and `e.stopPropagation()` on context-pill removal, resets `inputValue` on send, and invokes parent callbacks.

## Verification
- Run: `bun test`
