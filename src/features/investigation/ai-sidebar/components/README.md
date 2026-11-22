# AI Sidebar Components

## Overview
UI subcomponents for the Investigation AI sidebar, rendering message rows, reasoning/step progress bubbles, provider/model selection submenus, and the slash-command composer bar.

## Interface
- `[AIMessageRow.tsx:AIMessageRowProps]` — Props interface for message row data (`id`, `role`, `content`, `timestamp`, `context_logs?`, `a2ui_payload?`, `laya_routed?`, `laya_intent?`, `evaluation_notice?`, `steps?`), `prevMessage`, `isLoading`, `isLastMessage`, and `onA2UIAction`.
- `[AIMessageRow.tsx:AIMessageRow]` — Renders a chat message row with grouped avatar/timestamp suppression, log-context badge, `MessageContentBubble`, and live investigation indicator.
- `[MessageContentBubble.tsx:MessageContentBubbleProps]` — Props interface for bubble rendering state, parsed thinking/response strings, steps, evaluation notices, and A2UI payload.
- `[MessageContentBubble.tsx:MessageContentBubble]` — Renders hover copy controls, typing/step progress cards, evaluation notices, `ThinkingBlock`, `MarkdownContent`, and `A2UIRenderer`.
- `[ModelDropdownMenu.tsx:ModelDropdownMenuProps]` — Props interface for provider/model state, cached model lists, verification flags, and model callbacks.
- `[ModelDropdownMenu.tsx:ModelDropdownMenu]` — Renders provider/model selector trigger with nested submenus, search input, refresh/fetch actions, and OpenRouter quick-free model chips.
- `[SidebarInputBar.tsx:SidebarInputBarProps]` — Props interface for composer state, selected log IDs, model dropdown forwarding, reasoning toggle, and send/stop handlers.
- `[SidebarInputBar.tsx:SidebarInputBar]` — Renders the AI composer with `/` command autocomplete, removable log-context pill, reasoning toggle, and Send/Stop button.

## Invariants
- `[AIMessageRow.tsx:AIMessageRow]` User messages (`role === "user"`) bypass `parseThinking`; `showTypingIndicator` activates only when `!isUser && !thinking && !response && isLoading && isLastMessage`; `isPulseActive` activates only when `isStreamingThink && isLoading && isLastMessage`; consecutive same-role messages hide avatar and omit timestamp; non-ISO timestamps normalize space to `"T"` and append `"Z"` before `Date` parsing.
- `[MessageContentBubble.tsx:MessageContentBubble]` Suppresses hover copy while `showTypingIndicator` is true; renders `evaluationNotice`, `ThinkingBlock`, and `steps` only when `!isUser`; empty assistant response falls back to `"Completed multi-step investigation."` if `steps.length > 0` or `"No response content received."` otherwise.
- `[ModelDropdownMenu.tsx:ModelDropdownMenu]` Lists 6 providers (`ollama`, `openai`, `ai-studio`, `openrouter`, `openai-compatible`, `lmstudio`); `"openai-compatible"` requires `openaiCompatKey` or non-empty `openaiHost` distinct from `"https://api.openai.com/v1"`; search renders only when `rawModels.length > 7`; submenu close resets `modelSearchQuery`; selecting or fetching on an inactive provider calls `onProviderChange(provider.id)` first; refresh/fetch buttons disable while `isFetchingModels` is true.
- `[SidebarInputBar.tsx:SidebarInputBar]` `handleSend` ignores empty/whitespace input and disables Send; `isLoading` replaces Send with Stop (`onStopStream`); slash menu opens only when input starts with `"/"` and filters `AI_COMMANDS` by prefix; `Backspace` on empty input with selected logs invokes `onClearSelection()`; non-Shift `Enter` submits and `Escape` closes the command menu.

## Side Effects
- `[MessageContentBubble.tsx:handleCopy]` Writes text to `navigator.clipboard.writeText` and schedules a `2000` ms `setTimeout` to clear copied state.
- `[ModelDropdownMenu.tsx:ModelDropdownMenu]` Invokes `onFetchModels`, `onProviderChange`, and `onModelChange` callbacks on user selection or refresh actions.
- `[SidebarInputBar.tsx:SidebarInputBar]` Calls `textareaRef.current?.focus()` on slash command selection, prevents default newline on non-Shift `Enter`, and invokes `onSendMessage`, `onStopStream`, `onClearSelection`, `onToggleReasoning`, and forwarded model callbacks.

## Verification
- Run: `bun test`
