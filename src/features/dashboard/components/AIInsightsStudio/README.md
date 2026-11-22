# AIInsightsStudio

## Overview
Interactive AI Insights Studio workspace component for dashboard log analytics, combining session history controls, starter prompt cards, `@` workspace/catalog and `/` skill autocomplete composers, pipeline/thinking message cards, and an A2UI visual preset launcher.

## Interface
- `[index.ts]` — Re-exports all symbols from `./AIInsightsStudio`, `./QuickPromptStarters`, `./StudioFloatingControls`, `./StudioMessageCard`, and `./StudioPromptInput` (`AtMentionMenu` and `SlashCommandMenu` are internal to the package).
- `[AIInsightsStudio.tsx:AIInsightsStudio]` — Top-level studio container wiring Zustand stores (`useAiStore`, `useInvestigationStore`, `useSettingsStore`, `useUIStore`, `useWorkspaceStore`) and sidecar `get_ai_models` RPC to the message stream and composer.
- `[AtMentionMenu.tsx:AtMentionItem]` — Interface defining `@` mention entries (`type: "catalog" | "workspace" | "action"`, `data` with `sourceId`/`sourceName`/`workspaceId`/`actionType`).
- `[AtMentionMenu.tsx:AtMentionMenu]` — Renders the `@` catalog, workspace, and global action autocomplete menu.
- `[QuickPromptStarters.tsx:QuickPromptStarters]` — Renders the 4-card starter prompt grid when `dashboardMessages` is empty.
- `[SlashCommandMenu.tsx:SkillCommandItem]` — Interface defining `/` A2UI skill entries (`category: "Visuals" | "Analytics" | "Drilldown"`, `promptTemplate`).
- `[SlashCommandMenu.tsx:SKILL_COMMANDS]` — Exported array of 8 predefined `/` skill blueprints (`/histogram`, `/timeline`, `/errors`, `/clusters`, `/metrics`, `/table`, `/rootcause`, `/drilldown`).
- `[SlashCommandMenu.tsx:SlashCommandMenu]` — Renders the `/` A2UI skill autocomplete menu.
- `[StudioDiagramHelperModal.tsx:VisualPreset]` — Interface defining A2UI diagram/metric/table preset metadata (`id`, `title`, `description`, `icon`, `category`, `badge`, `color`, `prompt`).
- `[StudioDiagramHelperModal.tsx:StudioDiagramHelperModal]` — Modal dialog for browsing and inserting A2UI visual presets by category.
- `[StudioFloatingControls.tsx:StudioFloatingControls]` — Floating session indicator pill, session history dropdown, and new-chat trigger.
- `[StudioMessageCard.tsx:StudioMessageCardProps]` — Props interface for studio chat message rendering, pipeline steps, thinking display, and A2UI action dispatch.
- `[StudioMessageCard.tsx:StudioMessageCard]` — Renders user messages (with parsed scope badges) and assistant messages (`ThinkingBlock`, pipeline steps, `MarkdownContent`, and `A2UIRenderer`).
- `[StudioPromptInput.tsx:TargetCatalogScope]` — Interface defining an attached catalog or workspace scope (`id`, `name`, `workspaceId?`, `workspaceName?`).
- `[StudioPromptInput.tsx:StudioPromptInput]` — Prompt composer supporting `@` scope pills, `/` skill insertion, `ModelDropdownMenu`, reasoning toggle, and send/stop controls.

## Invariants
- `[AIInsightsStudio.tsx:AIInsightsStudio]` Defaults `activeWorkspaceId` to `"default"`, `ai_provider` to `"openrouter"`, and `isReasoningEnabled` to `true`; renders `QuickPromptStarters` when `dashboardMessages` is empty, otherwise renders `StudioMessageCard` with `thinking={null}`, `isPulseActive={false}`, `isStreaming={isAssistant && isLast && isDashboardLoading}`, and `showTypingIndicator={isStreaming && !msg.content}`.
- `[AIInsightsStudio.tsx:handleSendMessage]` When `activeCatalogScopes` is non-empty, prepends `[TARGET CATALOGS: <name> (source_id: "<id>"), ...] `, resets `activeCatalogScopes` to `[]`, and sends with `session_type: "dashboard"`.
- `[AIInsightsStudio.tsx:handleA2UIAction]` Ignores non-object actions; only handles `act.type === "filter"` (fixed filter id `"lvl-filter"`, `field: "level"`, `operator: "equals"`) and `act.type === "query"` (string `query`).
- `[AtMentionMenu.tsx:AtMentionMenu]` Orders filtered items strictly as catalogs (`cat-<wsId>-<srcId>`), workspaces (`ws-<wsId>`), then global action (`act-all` / `"all_catalogs"`).
- `[SlashCommandMenu.tsx:SlashCommandMenu]` Filters the 8 `SKILL_COMMANDS` case-insensitively across `command`, `title`, `description`, and `category`, clamping active child index with `Math.min(selectedIndex, filteredItems.length - 1)`.
- `[StudioDiagramHelperModal.tsx:StudioDiagramHelperModal]` Restricts `activeTab` to `"All" | "Histograms" | "Metrics" | "Tables" | "Drilldown"`, invokes `onSelectPrompt(prompt)`, and closes on selection.
- `[StudioFloatingControls.tsx:StudioFloatingControls]` Matches `activeSession` strictly by `s.session_id === currentSessionId`, renders the history dropdown only when `sessions.length > 0`, and calls `e.stopPropagation()` before `onDeleteSession(s.session_id)`.
- `[StudioMessageCard.tsx:StudioMessageCard]` Strips `[[A2UI]]` tags via `stripA2UITags` before Markdown rendering or copy (falling back to `"Analysis complete."` when empty); suppresses copy/body/thinking/steps/A2UI while `showTypingIndicator` is true; extracts attached scope chips matching `/^\[TARGET CATALOGS?: (.*?)\]\s*(.*)$/s`.
- `[StudioPromptInput.tsx:StudioPromptInput]` `@` and `/` autocomplete menus are mutually exclusive and open only at index 0 or after whitespace (`/\s/`) without spaces in the query; `activeCatalogScopes` deduplicates by `scope.id` and triggers `onSwitchWorkspace` when attaching a catalog from another workspace; `handleSend` no-ops when `!input.trim() || isLoading` and `ArrowUp` clamps via `Math.max(0, prev - 1)`.

## Side Effects
- `[AIInsightsStudio.tsx:AIInsightsStudio]` Scrolls `scrollRef.current` to `scrollHeight` on message/loading changes; fetches sessions (`fetchSessions`) and settings (`fetchSettings`) in `useEffect`.
- `[AIInsightsStudio.tsx:fetchModels]` Calls sidecar RPC `"get_ai_models"` via `callSidecar`, updates `settingsStore` (`setProviderCachedModels`, `markProviderVerified`), toggles `isFetchingModels`, and logs `console.warn` on error.
- `[AIInsightsStudio.tsx:handleProviderChange]` & `[AIInsightsStudio.tsx:handleModelChange]` Mutate `settingsStore` (`updateSettings`, `flushPendingSettings`) and fetch models on provider change.
- `[AIInsightsStudio.tsx:handleSendMessage]` / `[AIInsightsStudio.tsx:handleNewSession]` / `[AIInsightsStudio.tsx:handleDeleteSession]` Mutate `aiStore` (`sendMessage`, `setDashboardSession`, `deleteSession`).
- `[AIInsightsStudio.tsx:handleA2UIAction]` Mutates `investigationStore` (`setSearchQuery`, `setFilters`) and switches route via `useUIStore.setActiveNav("investigation")`.
- `[AtMentionMenu.tsx:AtMentionMenu]` & `[SlashCommandMenu.tsx:SlashCommandMenu]` Call `scrollIntoView` on the active list child DOM node.
- `[StudioMessageCard.tsx:StudioMessageCard]` Writes to `navigator.clipboard.writeText`, schedules a `2000` ms `setTimeout`, and triggers `onA2UIAction`.
- `[StudioPromptInput.tsx:StudioPromptInput]` Dispatches synthetic `.click()` on `document.querySelector(".custom-scrollbar button")` on `Enter`/`Tab` while menus are open, calls `textareaRef.current?.focus()`, and invokes parent scope/model/stream callbacks.

## Verification
- Run: `bun test`
