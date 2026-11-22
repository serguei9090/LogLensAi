# Common Components

## Overview
Canonical shared UI component implementations for LogLensAi, spanning log severity/status primitives, interactive search/filter/highlight builders, ECharts wrappers, workspace navigation, hierarchical file/source trees, and ingestion/model weight overlays.

## Interface
- `[index.ts:export *]` - Barrel re-exporting core shared components and types (`DecryptedText`, `GridPattern`, `HelpTooltip`, `IconButton`, `IngestionProgressBadge`, `LogLevelBadge`, `MarkdownContent`, `ReactECharts`, `SidebarNavItem`, `SpotlightCard`, `StatCard`, `StatusDot`, `TailSwitch`, `ThinkingBlock`, `TypingIndicator`, `AddColumnModal`, `ClusterRow`, `ConfirmationDialog`, `DashboardModeToggle`, `DashboardMode`, `FacetExtractionSettings`, `FacetList`, `FilterBuilder`, `FilterEntry`, `HardwareAcceleration`, `HardwareAccelerationProps`, `HierarchyTree`, `HighlightBuilder`, `HighlightEntry`, `IngestionOverlay`, `LevelBar`, `ModelWeightsStatus`, `ModelWeightsStatusData`, `ModelWeightsStatusProps`, `NativeFilePicker`, `ProcessingNotification`, `SearchBar`, `SourceItem`, `SourceSelector`, `TimeRangePicker`, `TimeRange`, `WorkspaceTabs`).
- `[TimeRangePicker.tsx:TimeRangePicker]` - Re-exports `TimeRangePicker` and all exports from `./time-picker`.
- `[AddColumnModal.tsx:AddColumnModal]` - Exported modal component creating custom regex-extracted log table columns with live sample preview.
- `[ClusterRow.tsx:ClusterRow]` - Exported `Readonly<ClusterRowProps>` expandable cluster summary row with sample fetching and AI diagnosis trigger.
- `[ConfirmationDialog.tsx:ConfirmationDialog]` - Exported confirmation modal dialog (`confirmText` default `'Confirm'`, `variant` default `'default'`).
- `[DashboardModeToggle.tsx:DashboardMode]` - Exported union type `'static' | 'ai'`.
- `[DashboardModeToggle.tsx:DashboardModeToggle]` - Exported animated pill toggle switching between `'Static'` and `'AI Insights'`.
- `[DecryptedText.tsx:DecryptedText]` - Exported scrambled-reveal text animation component (`speed=40`, `maxIterations=10`, `animateOn='always'`).
- `[FacetExtractionSettings.tsx:FacetExtractionRule]` - Exported interface `{ name: string; regex: string; group: number; enabled: boolean }`.
- `[FacetExtractionSettings.tsx:FacetExtractionSettings]` - Exported preset and custom regex facet extraction rule editor.
- `[FacetList.tsx:FacetList]` - Exported accordion facet filter list synced with `useInvestigationStore`.
- `[FilterBuilder.tsx:FilterEntry]` - Exported interface `{ id: string; field: string; operator: 'equals' | 'not_equals' | 'contains' | 'not_contains' | 'starts_with' | 'regex'; value: string }`.
- `[FilterBuilder.tsx:FilterBuilder]` - Exported filter popover and ordered active-filter list editor.
- `[GridPattern.tsx:GridPattern]` - Exported decorative SVG dot-matrix pattern (`aria-hidden='true'`, `pointer-events-none`).
- `[HardwareAcceleration.tsx:HardwareAccelerationProps]` - Exported readonly props interface for CPU/GPU mode switching.
- `[HardwareAcceleration.tsx:HardwareAcceleration]` - Exported CPU/GPU device selection cards.
- `[HelpTooltip.tsx:HelpTooltip]` - Exported help icon tooltip trigger and popover content.
- `[HierarchyTree.tsx:HierarchyTree]` - Exported `memo(HierarchyTreeImpl)` recursive folder and source explorer tree.
- `[HighlightBuilder.tsx:HighlightEntry]` - Exported interface `{ id: string; term: string; color: string }`.
- `[HighlightBuilder.tsx:HighlightBuilder]` - Exported log term highlight manager with `HexColorPicker`.
- `[IconButton.tsx:IconButton]` - Exported tooltip-wrapped ghost icon button.
- `[IngestionOverlay.tsx:IngestionOverlay]` - Exported ingestion progress overlay card.
- `[IngestionProgressBadge.tsx:IngestionStatus]` - Exported union `'queued' | 'pending' | 'processing' | 'completed' | 'failed'`.
- `[IngestionProgressBadge.tsx:IngestionProgressBadge]` - Exported compact badge rendering ingestion queue/progress state.
- `[LevelBar.tsx:LevelBar]` - Exported animated log-level count bar.
- `[LogLevelBadge.tsx:LogLevelBadge]` - Exported log severity `Badge`.
- `[MarkdownContent.tsx:MarkdownContent]` - Exported `ReactMarkdown` + `remarkGfm` renderer with fenced code copy support.
- `[ModelWeightsStatus.tsx:ModelWeightsStatusData]` - Exported interface `{ state: 'ready' | 'downloading' | 'idle' | 'error'; progress: number; downloaded_bytes: number; total_bytes: number; error_message?: string }`.
- `[ModelWeightsStatus.tsx:ModelWeightsStatusProps]` - Exported readonly props interface.
- `[ModelWeightsStatus.tsx:ModelWeightsStatus]` - Exported model weight status, progress, and download/retry card.
- `[NativeFilePicker.tsx:NativeFilePicker]` - Exported text input + Browse button wrapping Tauri native dialogs and browser file inputs.
- `[ProcessingNotification.tsx:ProcessingNotification]` - Exported aggregate active-ingestion progress banner.
- `[ReactECharts.tsx:ReactECharts]` - Exported Apache ECharts wrapper with `ResizeObserver` and event management.
- `[SearchBar.tsx:SearchBar]` - Exported forwarded-ref search input with 300 ms debounce and immediate clear.
- `[SidebarNavItem.tsx:SidebarNavItemProps]` - Exported props interface.
- `[SidebarNavItem.tsx:SidebarNavItem]` - Exported collapsible navigation button with collapsed tooltip wrapping.
- `[SourceItem.tsx:SourceItem]` - Exported `React.memo` source list item with inline rename, duplication, tail badge, and deletion actions.
- `[SourceSelector.tsx:SourceSelector]` - Exported segmented source selector control.
- `[SpotlightCard.tsx:SpotlightCard]` - Exported mouse-tracking radial spotlight card.
- `[StatCard.tsx:StatCard]` - Exported metric card with trend glyph and skeleton loading state.
- `[StatusDot.tsx:StatusDot]` - Exported animated ping status indicator dot.
- `[TailSwitch.tsx:TailSourceType]` - Exported union `'local' | 'ssh' | 'manual' | 'fusion' | 'live'`.
- `[TailSwitch.tsx:TailSwitch]` - Exported source-aware live-tail toggle switch with availability guards.
- `[ThinkingBlock.tsx:ThinkingBlock]` - Exported collapsible AI reasoning block with auto-expand/auto-collapse timers.
- `[TypingIndicator.tsx:TypingIndicator]` - Exported three-dot typing indicator.
- `[WorkspaceTabs.tsx:WorkspaceTabs]` - Exported multi-source workspace tab bar with inline renaming, tail indicators, and fusion edit triggers.
- Child contract: [time-picker](./time-picker/README.md).

## Invariants
- `[AddColumnModal.tsx:AddColumnModal]` Fetches samples only when `open && activeWorkspace?.id`; requires non-empty trimmed `label` and `regex` plus `!regexError` before generating `custom_<slug>_<Date.now()>` and closing; clears preview on blank or invalid `RegExp`.
- `[ClusterRow.tsx:ClusterRow]` Fetches sample logs via `get_logs` only on first expansion (`nextState && samples.length === 0`) when `clusterId && workspaceId` exist; appends `ERROR`/`FATAL`/`CRITICAL` level filters when `type === 'error'`; renders Diagnose button only when `clusterId && workspaceId` are truthy.
- `[ConfirmationDialog.tsx:ConfirmationDialog]` Confirm button unconditionally invokes `onConfirm()` followed by `onOpenChange(false)`.
- `[DecryptedText.tsx:DecryptedText]` Disables scramble animation when `prefers-reduced-motion` matches or `animateOn === 'hover' && !isHovered`; preserves whitespace/newlines and restores exact `text` when complete.
- `[FacetExtractionSettings.tsx:FacetExtractionSettings]` Guards rule iteration with `Array.isArray(rules)`, clamps group indices via `Number.parseInt(..., 10) || 1`, and toggles presets by `rule.name`.
- `[FacetList.tsx:FacetList]` Defaults expanded facets to `Set(['ip', 'uuid', 'level', 'email', 'user_id'])`, maps `'level'` vs `'facets.<key>'`, and toggles filters in `useInvestigationStore` when `onApplyFilter` is omitted.
- `[FilterBuilder.tsx:FilterBuilder]` Guards `handleAdd` on non-empty `value.trim()` and disables upward/downward move buttons at list boundaries (`i === 0` / `i === filters.length - 1`).
- `[HierarchyTree.tsx:HierarchyTreeImpl]` Treats `node.id === 'root'` as a flat container without rename/delete/collapse controls; warns before deleting a source with active `'queued' | 'pending' | 'processing'` jobs; commits folder rename only on non-empty trimmed input.
- `[HighlightBuilder.tsx:HighlightBuilder]` Ignores blank `term.trim()` additions and caps recent `customColors` to 4 deduplicated entries.
- `[IngestionOverlay.tsx:IngestionOverlay]` & `[IngestionProgressBadge.tsx:IngestionProgressBadge]` Clamp progress percentages/ratios (`[0, 100]` / `[0, 1]`), and `IngestionProgressBadge` returns `null` when `status === 'completed'`.
- `[LevelBar.tsx:LevelBar]` & `[ProcessingNotification.tsx:ProcessingNotification]` Guard percentage denominators with `total > 0` checks; `ProcessingNotification` returns `null` when no jobs are `'processing' | 'pending'`.
- `[MarkdownContent.tsx:MarkdownContent]` Strips one trailing newline and uses `CodeBlockWithCopy` only for fenced language classes or multiline snippets.
- `[ModelWeightsStatus.tsx:ModelWeightsStatus]` Renders skeleton when `isLoading || modelStatus === null`, enforces a 2% minimum progress width while `'downloading'`, and displays error details only when `state === 'error' && modelStatus.error_message`.
- `[NativeFilePicker.tsx:NativeFilePicker]` Branches between Tauri native single-file dialog (`'__TAURI_INTERNALS__' in globalThis.window`) and browser `<input type="file">`.
- `[ReactECharts.tsx:ReactECharts]` Guards all ECharts operations on non-null `containerRef.current` / `chartInstanceRef.current`, compares `JSON.stringify(option)` before `setOption`, cancels pending `requestAnimationFrame` resizes, and unbinds registered event handlers on cleanup.
- `[SearchBar.tsx:SearchBar]` Debounces `onChange` by 300 ms while `handleClear` calls `onChange("")` immediately; `[SidebarNavItem.tsx:SidebarNavItem]` disables click when `disabled || active`.
- `[SourceItem.tsx:SourceItem]` & `[WorkspaceTabs.tsx:WorkspaceTabs]` Guard renames on non-empty trimmed text, force `"processing"` badge when `transitioningSourceIds.has(source.id)`, call `e.stopPropagation()` on nested actions, and omit tail/duplicate controls on `"fusion"` tabs; `WorkspaceTabs` returns `null` when `sources.length === 0`.
- `[SpotlightCard.tsx:SpotlightCard]` Freezes cursor spotlight updates when `isFocused` is true; `[TailSwitch.tsx:TailSwitch]` evaluates `isFileMissing` before `sourceType`, sets `effectiveDisabled = disabled || isFileMissing || sourceType === 'manual'`, and guards `onCheckedChange` on `!effectiveDisabled`.
- `[ThinkingBlock.tsx:ThinkingBlock]` Returns `null` when `!content && !isStreaming`, auto-expands on stream start, and schedules a 2000 ms collapse timer after streaming ends.

## Side Effects
- `[AddColumnModal.tsx:AddColumnModal]` Reads `useWorkspaceStore`, invokes sidecar RPC `get_sample_logs`, and calls `Date.now()`.
- `[ClusterRow.tsx:ClusterRow]` Invokes sidecar RPC `get_logs`, logs `console.error`, and triggers `useUIStore.getState().openDiagnostic`.
- `[DecryptedText.tsx:DecryptedText]` Queries `window.matchMedia('(prefers-reduced-motion: reduce)')`, runs a `setInterval` timer calling `Math.random()`, and clears it on cleanup.
- `[FacetList.tsx:FacetList]` & `[FilterBuilder.tsx:FilterBuilder]` & `[HighlightBuilder.tsx:HighlightBuilder]` Generate IDs via `crypto.randomUUID()` and mutate `useInvestigationStore` (`setFilters`) or invoke `onChange`.
- `[HierarchyTree.tsx:HierarchyTreeImpl]` Mutates `useWorkspaceStore`, calls `duplicateSource`, reads `useIngestionStore`, and triggers `onNavSelect('investigation')`.
- `[MarkdownContent.tsx:MarkdownContent]` Writes code snippets to `navigator.clipboard.writeText` and sets a 2000 ms `setTimeout`.
- `[NativeFilePicker.tsx:NativeFilePicker]` Dynamically imports `@tauri-apps/plugin-dialog` (showing `toast.error` and `console.warn` on failure) or creates/clicks an off-DOM `<input type="file">`.
- `[ReactECharts.tsx:ReactECharts]` Instantiates/disposes ECharts on DOM containers, binds `ResizeObserver` and `requestAnimationFrame` callbacks, and registers/unregisters chart event listeners.
- `[SpotlightCard.tsx:SpotlightCard]` Reads DOM layout via `getBoundingClientRect()`; `[ThinkingBlock.tsx:ThinkingBlock]` scrolls `scrollRef.current`, runs a 100 ms duration `setInterval`, and schedules a 2000 ms auto-collapse `setTimeout`.

## Verification
- Run: `bun test`
