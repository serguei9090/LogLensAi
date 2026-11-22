# AI Insights Studio

## Overview
Interactive dashboard AI studio providing workspace-scoped and catalog-scoped conversational log analysis, `@` mention catalog/workspace targeting, `/` skill command presets, visual diagram presets, and live A2UI chart/metric/table rendering.

## Interface
- `[index.ts:AIInsightsStudio]` - Re-exports `AIInsightsStudio` from `./AIInsightsStudio`.
- `[index.ts:QuickPromptStarters]` - Re-exports `QuickPromptStarters` from `./QuickPromptStarters`.
- `[index.ts:StudioFloatingControls]` - Re-exports `StudioFloatingControls` from `./StudioFloatingControls`.
- `[index.ts:StudioMessageCard]` - Re-exports `StudioMessageCard` from `./StudioMessageCard`.
- `[index.ts:StudioPromptInput]` - Re-exports `StudioPromptInput` from `./StudioPromptInput`.
- `[AIInsightsStudio.tsx:AIInsightsStudio]` - Exported React component orchestrating dashboard AI sessions, provider/model switching, catalog scoping, message streaming, and A2UI action routing.
- `[AtMentionMenu.tsx:AtMentionItem]` - Exported interface describing catalog, workspace, and global-scope `@` mention entries.
- `[AtMentionMenu.tsx:AtMentionMenu]` - Exported React component rendering the keyboard-navigable `@` mention popover list.
- `[QuickPromptStarters.tsx:QuickPromptStarters]` - Exported React component rendering initial diagnostic prompt cards when a session has no messages.
- `[SlashCommandMenu.tsx:SkillCommandItem]` - Exported interface describing slash skill command metadata and prompt templates.
- `[SlashCommandMenu.tsx:SKILL_COMMANDS]` - Exported array of 8 built-in skill commands (`/histogram`, `/timeline`, `/errors`, `/clusters`, `/metrics`, `/table`, `/rootcause`, `/drilldown`).
- `[SlashCommandMenu.tsx:SlashCommandMenu]` - Exported React component rendering the filtered `/` skill command palette.
- `[StudioDiagramHelperModal.tsx:VisualPreset]` - Exported interface describing preset diagram configurations for the studio helper modal.
- `[StudioDiagramHelperModal.tsx:StudioDiagramHelperModal]` - Exported React component rendering a triggerable modal gallery of categorized visual analysis presets.
- `[StudioFloatingControls.tsx:StudioFloatingControls]` - Exported React component rendering the active session badge, session history switcher with delete controls, and new-session button.
- `[StudioMessageCard.tsx:StudioMessageCardProps]` - Exported interface defining props for studio chat message cards.
- `[StudioMessageCard.tsx:StudioMessageCard]` - Exported React component rendering user scope badges, thinking blocks, execution steps, markdown bodies, copy actions, and A2UI payloads.
- `[StudioPromptInput.tsx:TargetCatalogScope]` - Exported interface `{ id: string; name: string; workspaceId?: string; workspaceName?: string }`.
- `[StudioPromptInput.tsx:StudioPromptInput]` - Exported React component rendering the studio composer with mutually exclusive `@`/`/` menus, catalog scope pills, diagram helper trigger, reasoning toggle, model menu, and send/stop controls.

## Invariants
- `[AIInsightsStudio.tsx:AIInsightsStudio]` Defaults `activeWorkspaceId` to `activeWorkspace?.id ?? "default"`, `currentProvider` to `settings.ai_provider || "openrouter"`, `currentModel` to `settings.ai_model || ""`, and `isReasoningEnabled` to `true`; renders `<QuickPromptStarters />` when `dashboardMessages.length === 0`.
- `[AIInsightsStudio.tsx:fetchModels]` Caches models only when `result?.models` is truthy, marks provider verified only when `result.verified` is truthy, and clears `isFetchingModels` in `finally`.
- `[AIInsightsStudio.tsx:handleSendMessage]` When `activeCatalogScopes.length > 0`, prepends `[TARGET CATALOGS: ...]` metadata and resets `activeCatalogScopes` to `[]`; always sends `session_type: "dashboard"`.
- `[AIInsightsStudio.tsx:handleA2UIAction]` Guards against non-object actions and navigates to `"investigation"` for `"filter"` (updating `searchQuery` and/or single level filter) and `"query"` actions.
- `[AtMentionMenu.tsx:AtMentionMenu]` Orders items strictly `[...allCatalogItems, ...workspaceItems, ...actionItems]` filtered by `query.toLowerCase().trim()`, always appending `"act-all"` when matched; `onClose` in `AtMentionMenuProps` is unused.
- `[SlashCommandMenu.tsx:SlashCommandMenu]` Filters `SKILL_COMMANDS` case-insensitively on `command`, `title`, `description`, or `category` and clamps scroll index via `Math.min(selectedIndex, filteredItems.length - 1)`.
- `[StudioFloatingControls.tsx:StudioFloatingControls]` Shows active session pill only when `currentSessionId` matches an existing session and shows the History dropdown only when `sessions.length > 0`.
- `[StudioDiagramHelperModal.tsx:StudioDiagramHelperModal]` Starts closed (`isOpen = false`, `activeTab = "All"`), filters `VISUAL_PRESETS` by category unless `"All"`, and closes on preset selection, backdrop click, close click, or Escape.
- `[StudioMessageCard.tsx:StudioMessageCard]` Suppresses copy button, `ThinkingBlock`, steps, markdown body, and `A2UIRenderer` while `showTypingIndicator` is true; strips `[[A2UI]]` tags via `stripA2UITags`, falls back assistant text to `"Analysis complete."`, and extracts `[TARGET CATALOGS?: ...]` badges from user messages.
- `[StudioPromptInput.tsx:handleInputChange]` Keeps `@` and `/` popovers mutually exclusive (requiring boundary start-of-input or whitespace and no spaces before cursor, prioritizing whichever trigger appears later); deduplicates `activeCatalogScopes` by `s.id`, switches workspace via `onSwitchWorkspace` before adding cross-workspace catalogs, blocks sending when `!input.trim()` or `isLoading`, and suppresses unshifted Enter submission while either menu is open.

## Side Effects
- `[AIInsightsStudio.tsx:AIInsightsStudio]` Scrolls `scrollRef.current` to bottom on message/loading changes, calls `useAiStore` (`fetchSessions`, `sendMessage`, `setDashboardSession`, `deleteSession`), calls `useSettingsStore` (`fetchSettings`, `updateSettings`, `flushPendingSettings`, `setProviderCachedModels`, `markProviderVerified`), calls `useInvestigationStore` (`setSearchQuery`, `setFilters`) and `useUIStore` (`setActiveNav`), and invokes `callSidecar({ method: "get_ai_models", ... })` with `console.warn` on error.
- `[AtMentionMenu.tsx:AtMentionMenu]` Scrolls active child into view via `scrollIntoView` and invokes `onSelect`.
- `[SlashCommandMenu.tsx:SlashCommandMenu]` Scrolls active child into view via `scrollIntoView` and invokes `onSelect` / `onClose`.
- `[QuickPromptStarters.tsx:QuickPromptStarters]` Invokes `onSelectPrompt`.
- `[StudioFloatingControls.tsx:StudioFloatingControls]` Calls `e.stopPropagation()` on delete and invokes `onSelectSession`, `onDeleteSession`, and `onNewSession`.
- `[StudioDiagramHelperModal.tsx:handleSelect]` Invokes `onSelectPrompt` and closes modal state.
- `[StudioMessageCard.tsx:handleCopy]` Writes text to `navigator.clipboard.writeText(...)` and schedules an uncleaned 2000 ms `setTimeout` for `setCopied(false)`.
- `[StudioPromptInput.tsx:StudioPromptInput]` Queries `.custom-scrollbar button` via `document.querySelector` to trigger `.click()` on Enter/Tab when a menu is open, focuses `textareaRef.current?.focus()`, and invokes parent scope, workspace, model, reasoning, and send/stop callbacks.

## Verification
- Run: `bun test`
