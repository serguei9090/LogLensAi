# EGM Drift Report — 2026-11-22

> **Scope**: All 103 bootstrapped `README.md` contracts (`README.md` + 102 subdirectories) audited against current repository source files.
> **Summary**: **33** contracts with reported drift, **70** contracts with `No drift detected.`

---

## README.md

- `Key Features` and `Directory Layout` cite `config/laya_rules.json` under a `config/` directory; no `config/` directory exists (`laya_rules.json` sits at the repository root and `backend-go/internal/app/app.go` resolves `filepath.Join(dataDir, "laya_rules.json")`).
- `Dual-Engine AI Architecture` (diagram and `Key Features`) cites an `IntentRouter` between RPC and `graph.Run`, tools `get_logs` and `analyze_cluster`, and a System 2 `update_laya_rules` tool; `backend-go/internal/rpc/ai_methods.go` and `ai_stream.go` invoke `graph.Run` directly with no `IntentRouter`, and `backend-go/internal/ai/graph/tools.go` registers `search_logs`, `get_log_timeline`, `get_clusters`, `search_memory`, `search_knowledge`, `get_facets`, `get_hierarchy`, `create_column`, and `create_facet` (none of `get_logs`, `analyze_cluster`, or `update_laya_rules` exist as tools).
- `Real-Time Log Ingestion & Laya Cluster Triage` cites `OnClustersUpdated(clusterBatch)`, `"In-memory MD5 deduplication"`, and `get_dashboard_aggregates`; `backend-go/internal/services/clustering/batch.go` calls `TriageClustersAsync` on `LayaClusterTriager`, `backend-go/internal/app/laya_triage.go` deduplicates via raw template string equality in `seenTmpls` (no MD5 hashing), and `src/features/dashboard/hooks/useDashboardData.ts` queries `get_dashboard_stats`.
- `Key Features` describes Drain3 clustering as `"Single-threaded in-memory clustering"`, whereas `backend-go/internal/services/clustering/batch.go` runs `trainRows` sequentially (first `200` rows) and tags remaining rows concurrently in `tagRowsParallel` across `w.poolSize` goroutines.
- `Key Features` claims the Hugging Face Laya downloader performs `"SHA verification"`; `backend-go/internal/ai/laya/downloader.go` (`downloadSingleFile`) writes `.part` files and renames atomically without any checksum/SHA verification.
- `Technical Architecture`, `Key Features`, and `Getting Started` claim `"GPU DirectML/CUDA"` support for Laya ONNX; `backend-go/internal/ai/laya/engine_onnx.go` only calls `sessOpts.AppendExecutionProviderDirectML(0)` for `"gpu"` and configures no CUDA provider.
- `Tooling & Tech Stack` cites a `dashboard` Zustand store (`investigation, dashboard, layaStore`); no `dashboard` store exists in `src/store/` (`src/store/` contains `aiStore`, `clusteringStore`, `debugStore`, `healthStore`, `investigationStore`, `layaStore`, `settingsStore`, `uiStore`, `workspaceStore`, and `ingestion/`).
- `Directory Layout` lists `LayaSettingsPanel, Dashboard` under `src/components/organisms/` and omits `src/features/`, `scripts/`, and `tests/`; `src/components/organisms/` has `DashboardCharts.tsx` (not `Dashboard`, while `DashboardPage.tsx` lives in `src/components/pages/` and `src/features/dashboard/`, and `LayaSettingsPanel.tsx` lives in `src/components/organisms/laya-settings/` and `src/features/laya/`).
- `Getting Started` instructs opening `"Laya AI Engine"`, toggling `"Enable Laya AI Decision Engine"`, and clicking `"Download Model Weights"`; `src/features/settings/SettingsPanel.tsx` labels the tab `"Laya AI"`, `src/features/laya/components/LayaHeaderBanner.tsx` labels the banner `"Laya System 1 Decision Engine"` with an `"Active"` / `"Disabled"` switch, and `src/components/common/ModelWeightsStatus.tsx` renders `"Download (524 MB)"`.
- `Roadmap & Research Exploration` leaves `"EmbeddingGemma-2 Local Knowledge Base & Resolution RAG"` unchecked (`[ ]`) with dual ONNX/Ollama (`embeddinggemma-2`) drivers, `<knowledge_path>/Memory/*.md` persistence, and `fsnotify` watcher + `"Re-index"`, whereas `backend-go/internal/ai/rag/` hardcodes `nomic-ai/nomic-embed-text-v1.5` (only labeled `EmbeddingGemma-2` in `src/features/settings/sections/RAGSettingsSection.tsx`), implements no Ollama embedding driver (`rag_embedder_type`/`rag_device`/`rag_ollama_host` are unused in `backend-go`), and already implements Markdown resolution export (`markdown_export.go`), `fsnotify` watching/scanning (`watcher.go`, though `NewKnowledgeWatcher` does not start `eventLoop`), and `"Re-index"` (`sync_knowledge_base`).
- `Local Interface & Invariants` omits `**/*.state`, `**/*.tmp*`, `**/laya_rules*.json*`, `**/.rag_download_tmp*`, `drain/**`, `data/**`, and `sidecar/**` from `[vite.config.ts:default]`'s `watch.ignored`; omits `node_modules`, `.agents`, and `.kilo` from `[vitest.config.ts:default]`'s `exclude`; and omits `preview`, `tauri`, `lint:fix`, `format`, `test:watch`, `test:contract`, `test:integration`, and `test:bench` from `[package.json:scripts]` (where `type-sync` also references `scripts/generate_schema.py` -> `sidecar/src/models.py`, which does not exist).
- `Global Invariants` cites `http://127.0.0.1:5000/rpc` for web/dev frontend calls, whereas `src/lib/hooks/useSidecarBridge.ts` defaults `SIDECAR_BASE_URL` to `"http://localhost:5000"` (`SIDECAR_URL = "http://localhost:5000/rpc"`).

## backend-go/README.md

- `## Subdirectories & Boundaries` summarizes `internal` as covering `ai`, `app`, `db`, `drain3`, `ingestion`, `metadata`, `query`, `rpc`, and `services`, omitting `internal/models` (`requests.go`, `requests_laya.go`, `requests_logops.go`, `rpc.go`, `shared.go`).

## backend-go/cmd/README.md

No drift detected.

## backend-go/cmd/sidecar/README.md

No drift detected.

## backend-go/internal/README.md

- `## Subdirectories & Boundaries` omits the `models` subdirectory (`backend-go/internal/models/`, containing `requests.go`, `requests_laya.go`, `requests_logops.go`, `rpc.go`, and `shared.go`), which also has no `README.md`.

## backend-go/internal/ai/README.md

- `## Side Effects` states `[rpc_extra.go:Extra.SyncKnowledgeBase]` reads/writes DuckDB `(logs, cluster_triage, ai_memory)`, omitting `knowledge_documents` (which `SyncKnowledgeBase` populates via `rag.KnowledgeWatcher.ScanAll` -> `rag.Service.IngestKnowledgeFile`).
- `## Invariants` documents `[wiring.go:lazyMemorySearcher.SearchMemory]`, omitting `[wiring.go:lazyMemorySearcher.SearchKnowledge]` (which implements the second method of `graph.MemorySearcher` by delegating to `rag.Service.SearchKnowledge`).
- `## Invariants` states `[wiring.go:NewProviderFromSettings]` maps provider-specific hosts from settings, whereas for `"openai"` it hardcodes `"https://api.openai.com/v1"` (`wiring.go:134-135`) instead of reading `s["ai_openai_host"]` (`ai_openai_host` is only read for `"openai-compatible"`).

## backend-go/internal/ai/graph/README.md

- `## Invariants` states `[graph.go:Run]` prepends A2UI, reasoning/action, and workspace-grounding system directives `"before the first non-empty user message on iteration 0"`, whereas `Run` checks whether the **last** `"user"` message is non-empty and prepends those directives at index `0` of `state.Messages` (before any earlier messages).

## backend-go/internal/ai/laya/README.md

- `## Invariants` groups `[engine.go:ONNXEngine.SetDevice]` and `[mock_engine.go:MockEngine.SetDevice]` with `NewONNXEngine` and `RuleManager.UpdateSettings` under `"(empty defaults to \"cpu\")"`, whereas both `SetDevice` methods reject `""` with an error instead of defaulting it to `"cpu"`.
- `## Invariants` states `[engine.go:NewONNXEngine]` clamps `maxLen` to `8192`, whereas it only passes `8192` to `NewSequenceBuilder` when `cfg.SequenceBuilder == nil` and does not clamp a caller-supplied `cfg.SequenceBuilder`.

## backend-go/internal/ai/providers/README.md

- `## Interface` notes that `OllamaProvider`, `OpenAICompatibleProvider`, and `GeminiProvider` implement `Provider`, without explicitly listing their 15 exported receiver methods (`OllamaProvider.{ListModels,Chat,ChatStream,AnalyzeLogs,TestConnection}`, `OpenAICompatibleProvider.{ListModels,Chat,ChatStream,AnalyzeLogs,TestConnection}`, `GeminiProvider.{ListModels,Chat,ChatStream,AnalyzeLogs,TestConnection}`).
- `## Invariants` states all three providers `"surface Chat/AnalyzeLogs HTTP or decode failures as assistant error messages or AnalysisResult{Summary: "Analysis failed"} with nil Go error"`, whereas `Chat` across all three providers returns a non-nil `error` on JSON response decode failures (and request marshal/build errors), `AnalyzeLogs` returns a non-nil `error` on request marshal/build errors, `OllamaProvider.AnalyzeLogs` returns an empty `AnalysisResult{}` when `data.Response == ""`, and `GeminiProvider.AnalyzeLogs` returns `AnalysisResult{Summary: "No API Key"}` when `apiKey == ""`.
- `## Invariants` states assistant history has `<think>` and channel markers stripped and native reasoning/thought segments wrapped in `<think>...</think>`, whereas `OpenAICompatibleProvider.formatMessages` passes assistant `m.Content` through without calling `cleanThinkingMarkers`, and `GeminiProvider.Chat` concatenates `part.Text` via `extractGeminiText` without wrapping `part.Thought` parts in `<think>...</think>` (only `GeminiProvider.ChatStream` handles `part.Thought`).
- `## Invariants` cites `[openai_compatible.go:normalizeOpenAIToolCalls]` for synthesizing `"call_<index>"` IDs when missing, whereas `normalizeOpenAIToolCalls` copies `c.ID` directly without synthesizing fallback IDs.

## backend-go/internal/ai/rag/README.md

No drift detected.

## backend-go/internal/app/README.md

- `## Invariants` groups `[handlers_dashboard.go:App.GetDashboardStats]` with `[handlers_logops_distribution.go:App.GetLogDistribution]` and states both `"short-circuit on empty active sourceIDs or fusion_configs sets"`, whereas `GetDashboardStats` (`GetDashboardStatsRequest`) has neither `SourceIDs` nor `FusionID` and does not short-circuit on empty `ActiveWorkspaceIDs`; additionally, `getDashboardBucketParams` sets fallback `bucketFormat` to `"%Y-%m-%d %H:00:00"` while `dashboardIntervals["1 hour"].format` is `"%Y-%m-%d %H:00"`.
- `## Invariants` states `[handlers_anomalies.go:App.detectAnomalies]` `"clamps baseline stddev_pop to 0.1 over [refTime-24h, refTime-10m)"`, whereas it only substitutes `0.1` when `stddev == 0` (leaving positive values `< 0.1` unchanged) and filters `hourly_cluster_counts` with `hour_bucket >= dayAgoBucket AND hour_bucket < tenMinsAgoBucket` (excluding the entire hour containing `refTime-10m`).
- `## Invariants` states `[handlers_workspace_lifecycle.go:App.FactoryReset]` `"tears down all workers/handles, deletes on-disk files, and re-initializes the stack"`, whereas `FactoryReset` does not close/recreate `LayaEngine` or delete `laya_rules.json` / `<dataDir>/models/laya`, and does not re-attach `NewLayaClusterTriager(a)` onto the recreated `clustering.Worker` (unlike `NewApp`).

## backend-go/internal/db/README.md

- `## Invariants` states `[vss.go:SetupVectorSearch]` degrades with `(VSSStatus.Degraded = true)`, whereas `VSSStatus.Degraded` is a `string` (a diagnostic message when degraded, empty when healthy), not a `bool`.
- `## Invariants` states `[db.go:Open]` `"opens at most one *DB per file path so database/sql shares a single duckdb_database handle"`, whereas `Open` enforces no process-wide singleton map or lock per path (calling `sql.Open("duckdb", dbPath)` unconditionally; single-open per path is a caller contract documented in `Open`'s doc comment).
- `## Invariants` states `[migrations.go:migrateDrainMasks]` `"fills missing default mask labels"`, whereas `migrateDrainMasks` only appends missing rules from its 9-entry `extraMasks` list and does not restore `IP` or `UUID` from `defaultDrainMasks` if missing.

## backend-go/internal/drain3/README.md

- `## Invariants` states `[tree.go:tree.treeSearch]` and `[tree.go:tree.addSeqToPrefixTree]` key the prefix tree `"first by token count then up to Depth-2 tokens"`, whereas `maxNodeDepth = cfg.Depth - 2` and the loops iterate `depth := 1` while `depth < t.maxNodeDepth` (and `depth < tokenCount`), keying by token count plus at most `Depth - 3` literal tokens (e.g., 1 token when `Depth == 4`).

## backend-go/internal/ingestion/README.md

No drift detected.

## backend-go/internal/metadata/README.md

No drift detected.

## backend-go/internal/query/README.md

- `## Interface` documents `Node` (`ToSQL() (string, []any)`) and the six concrete AST structs (`FieldNode`, `RangeNode`, `SearchNode`, `AndNode`, `OrNode`, `NotNode`) without individually listing their exported `ToSQL` receiver methods (`FieldNode.ToSQL`, `RangeNode.ToSQL`, `SearchNode.ToSQL`, `AndNode.ToSQL`, `OrNode.ToSQL`, `NotNode.ToSQL`).

## backend-go/internal/rpc/README.md

- `## Invariants` states `[ai_methods.go:sendAIMessage]` and `[ai_stream.go:streamChatHandler]` `"always calls finalizeAISession"`, whereas `sendAIMessage` returns an `RPCError` without calling `finalizeAISession` on `prepareAISession`, `runInvestigation`, or `chunk.Err != nil` failures, and `streamChatHandler` returns without calling `finalizeAISession` if `prepareAISession` or `runInvestigation` fails.
- `## Invariants` singles out `get_rag_model_status`/`download_rag_model`/`delete_rag_model` as skipping `json.Unmarshal` on empty params, whereas `appHandler` (`app_methods.go:133`) applies the same `if len(params) > 0` guard to all `appHandler`-wrapped methods (and `Dispatch` defaults empty `req.Params` to `"{}"` before invoking any handler).

## backend-go/internal/services/README.md

No drift detected.

## backend-go/internal/services/clustering/README.md

No drift detected.

## backend-go/internal/services/logstore/README.md

No drift detected.

## scripts/README.md

- `[inspect_db.py:SIDE_CAR_DIR]`, `[inspect_db.py:PROJECT_ROOT]`, `[inspect_db.py:DB_PATH]` (`## Interface`): Described as resolving `data/loglens.duckdb` relative to `__file__`'s parent directory, whereas `scripts/inspect_db.py` sets `SIDE_CAR_DIR` to `__file__`'s parent directory (`scripts/`) and `PROJECT_ROOT = os.path.dirname(SIDE_CAR_DIR)` (`__file__`'s grandparent / repository root), so `DB_PATH` resolves `<repo_root>/data/loglens.duckdb` (`../data/loglens.duckdb` relative to `__file__`'s parent directory).
- `[start-gemini-hot.ps1]` (`## Interface`): Omits `$env:USE_CCPA = "1"` and `$env:GEMINI_A2A_PERSISTENCE = "local"` (as well as the specific storage env var names `GEMINI_A2A_DB_PATH`, `GEMINI_DIR`, `GEMINI_TASK_STORAGE_PATH`, and `A2A_STORAGE_ROOT` summarized as local session storage).

## scripts/drain3/README.md

No drift detected.

## scripts/hooks/README.md

- `[agent_triggers.py:trigger_agent]` (`## Side Effects`): States `trigger_agent` "prints a confirmation message to stdout", whereas `trigger_agent` in `scripts/hooks/agent_triggers.py` only writes to `log_file` (and redirects child `stdout`/`stderr` to `log_file`); the stdout confirmation (`print("Agent tasks triggered. Check scripts/hooks/logs/agent_triggers.log for status.")`) is emitted by `main`.

## src-tauri/README.md

No drift detected.

## src-tauri/src/README.md

No drift detected.

## src/README.md

- `## Interface` (`Subdirectories`) omits `src/styles/` (`globals.css`), which is only referenced via `imports ./styles/globals.css` under `## Side Effects`.

## src/components/README.md

No drift detected.

## src/components/atoms/README.md

No drift detected.

## src/components/common/README.md

- `## Invariants` (`[FacetExtractionSettings.tsx:FacetExtractionSettings]`): Claims rule iteration is guarded with `Array.isArray(rules)` and group indices are clamped via `Number.parseInt(..., 10) || 1`. In `src/components/common/FacetExtractionSettings.tsx`, `Array.isArray(rules)` only guards `rules.map(...)` in `<tbody>` (line 199) and not `rules.find(...)`, `rules.findIndex(...)`, or `[...rules]` elsewhere (lines 89, 95, 101, 108, 120, 142, 264); `Number.parseInt(e.target.value, 10) || 1` (line 230) is a falsy fallback (`NaN`/`0` -> `1`) rather than a `[1, 9]` clamp.
- `## Invariants` (`[HierarchyTree.tsx:HierarchyTreeImpl]`): Claims it warns before deleting a source with active `'queued' | 'pending' | 'processing'` jobs. In `src/components/common/HierarchyTree.tsx`, the active-job check (`isTargetIngesting`) is only implemented in the non-root branch's `ConfirmationDialog` (lines 299–325); when `node.id === "root"` (lines 82–176), the root `ConfirmationDialog` (lines 159–173) does not inspect `jobs` and shows the generic delete message even when deleting an actively ingesting source.
- `## Invariants` (`[IngestionOverlay.tsx:IngestionOverlay]`): Claims `IngestionOverlay` clamps progress percentages to `[0, 100]`. In `src/components/common/IngestionOverlay.tsx` (lines 17–18), `Math.min(Math.round((processed / total) * 100), 100)` only clamps the upper bound at `100` (no `Math.max(0, ...)` lower clamp) and uses `job?.total_lines ?? 1`, which leaves `total_lines === 0` unguarded.
- `## Invariants` (`[SourceItem.tsx:SourceItem]` & `[WorkspaceTabs.tsx:WorkspaceTabs]`): Combines both components as forcing a `"processing"` badge via `transitioningSourceIds.has(source.id)` and omitting tail/duplicate controls on `"fusion"` tabs. In reality, `WorkspaceTabs.tsx` does not read `useIngestionStore` / `transitioningSourceIds` or render a `"processing"` badge (it hides the live-tail indicator and duplicate button on `"fusion"` tabs), while `SourceItem.tsx` does not check `source.type === "fusion"` or omit duplicate controls on fusion sources (and also requires `trimmed !== source.name` when confirming renames).

## src/components/common/time-picker/README.md

No drift detected.

## src/components/common/time-picker/components/README.md

No drift detected.

## src/components/molecules/README.md

No drift detected.

## src/components/molecules/time-picker/README.md

- `## Side Effects` (`[TimeRangePicker.tsx:TimeRangePicker]`): States it reads `new Date()` on state initialization and popover open, omitting that `const nowRef = new Date();` (line 43 of `src/components/molecules/time-picker/TimeRangePicker.tsx`) also reads `new Date()` on every render.

## src/components/molecules/time-picker/components/README.md

No drift detected.

## src/components/organisms/README.md

No drift detected.

## src/components/organisms/a2ui/README.md

No drift detected.

## src/components/organisms/a2ui/components/README.md

No drift detected.

## src/components/organisms/a2ui/utils/README.md

No drift detected.

## src/components/organisms/ai-sidebar/README.md

- `[AIInvestigationSidebar.tsx:AIInvestigationSidebar]` (`## Invariants`) states `fetchModels` "flushes `ai_provider` settings before calling `list_ai_models`", whereas `AIInvestigationSidebar.tsx` only calls `updateSettings({ ai_provider: targetProvider })` + `flushPendingSettings()` when `targetProvider && targetProvider !== settings.ai_provider`, or `flushPendingSettings()` when `forceRefresh` is `true`; calling `fetchModels(false)` without switching providers invokes `list_ai_models` without flushing.
- `[AIInvestigationSidebar.tsx:AIInvestigationSidebar]` (`## Side Effects`) states it "generates random default session IDs via `Math.random()`", whereas `generateDefaultName` uses `Math.random()` to generate random default session names (`pendingSessionName` formatted as `LOG-<6-digit>`), not session IDs.

## src/components/organisms/ai-sidebar/components/README.md

- `[MessageContentBubble.tsx:MessageContentBubble]` (`## Invariants`) states it "renders `evaluationNotice`, `ThinkingBlock` (when `thinking !== null || isPulseActive`), execution steps, `MarkdownContent`, and `A2UIRenderer` only when `!isUser && !showTypingIndicator`", whereas `MessageContentBubble.tsx` also renders `evaluationNotice` and execution `steps` inside the `if (showTypingIndicator)` branch (without a `!isUser` guard); only `ThinkingBlock`, `MarkdownContent`, and `A2UIRenderer` are restricted to `!isUser && !showTypingIndicator`.

## src/components/organisms/ai-sidebar/utils/README.md

No drift detected.

## src/components/organisms/custom-parser/README.md

- `[CustomParserModal.tsx:CustomParserModal]` (`## Invariants`) states `handleMouseUp` sets `activeSelection` only when a non-empty selection lies inside an element with `dataset.sampleLine === "true"` and `range.getBoundingClientRect().width > 0` and "otherwise clears `activeSelection` to `null`", whereas when `isSampleLine` is `true` and `rect.width <= 0`, `setActiveSelection(null)` is not called and `activeSelection` retains its prior value.

## src/components/organisms/import-modal/README.md

- `[ImportFeedModal.tsx:ImportFeedModal]` (`## Side Effects`) cites `setLocalPath` as a store field ("mutates `isDragOver` and store fields `setLocalPath`, `setImportOpen`, and `setImportActiveTab`"), whereas `setLocalPath` is a local destructuring alias for the `useIngestionStore` setter `setImportLocalPath`.

## src/components/organisms/import-modal/tabs/README.md

No drift detected.

## src/components/organisms/laya-settings/README.md

No drift detected.

## src/components/organisms/laya-settings/components/README.md

No drift detected.

## src/components/organisms/laya-settings/modals/README.md

No drift detected.

## src/components/organisms/log-table/README.md

- `[VirtualLogTable.tsx:VirtualLogTable]` (`## Invariants`) states floating action bar exclusivity is `(selectedLogIds.length > 0 && expandedRow === null && !isTransitioning && !isFetching)`, omitting the `logs.length > 0` guard enforced in `VirtualLogTable.tsx`.

## src/components/organisms/log-table/components/README.md

No drift detected.

## src/components/organisms/log-table/utils/README.md

No drift detected.

## src/components/organisms/orchestrator/README.md

No drift detected.

## src/components/organisms/orchestrator/components/README.md

No drift detected.

## src/components/organisms/settings/README.md

No drift detected.

## src/components/organisms/settings/components/README.md

No drift detected.

## src/components/organisms/settings/sections/README.md

No drift detected.

## src/components/organisms/settings/utils/README.md

No drift detected.

## src/components/pages/README.md

No drift detected.

## src/components/pages/dashboard/README.md

No drift detected.

## src/components/pages/dashboard/components/README.md

- `## Invariants` (`[DashboardFilters.tsx:DashboardFilters]`): States `"All Time"` reset renders whenever `timeBounds` exists and `timeRange` differs from `[timeBounds.min, timeBounds.max]`. In `src/components/pages/dashboard/components/DashboardFilters.tsx` (lines 45–48), `isFiltered` checks `(timeRange.start && timeRange.start !== timeBounds.min) || (timeRange.end && timeRange.end !== timeBounds.max)`, so empty `start`/`end` strings (e.g., `end: ""` from a relative preset or `{ start: "", end: "" }`) evaluate falsy and suppress the `"All Time"` reset button despite differing from `[timeBounds.min, timeBounds.max]`.

## src/components/pages/dashboard/components/AIInsightsStudio/README.md

- `## Interface` (`index.ts`): Lists the 5 re-exported components (`AIInsightsStudio`, `QuickPromptStarters`, `StudioFloatingControls`, `StudioMessageCard`, `StudioPromptInput`), omitting the types `StudioMessageCardProps` and `TargetCatalogScope` that `src/components/pages/dashboard/components/AIInsightsStudio/index.ts` also re-exports via `export * from "./StudioMessageCard"` and `export * from "./StudioPromptInput"` (they are only documented under their source files).
- `## Interface` (`[StudioPromptInput.tsx:StudioPromptInput]`): Claims `StudioPromptInput` renders a `diagram helper trigger`, whereas `src/components/pages/dashboard/components/AIInsightsStudio/StudioPromptInput.tsx` renders no diagram helper trigger (`StudioDiagramHelperModal` renders its own floating trigger independently in `AIInsightsStudio.tsx`).
- `## Invariants` (`[StudioDiagramHelperModal.tsx:StudioDiagramHelperModal]`): Claims the modal closes on `Escape`, whereas in `src/components/pages/dashboard/components/AIInsightsStudio/StudioDiagramHelperModal.tsx` (lines 145–153) the `Escape` `onKeyDown` handler is attached only to an unfocusable backdrop `<div>` without `tabIndex` (and with no `document`/`window` key listener).
- `## Side Effects` (`[AIInsightsStudio.tsx:AIInsightsStudio]`): Lists `useAiStore (fetchSessions, sendMessage, setDashboardSession, deleteSession)` and omits `stopStream` (also pulled from `useAiStore` at line 29 and passed to `StudioPromptInput.onStopStream`), as well as `useWorkspaceStore`'s `setActive` (line 51, passed to `StudioPromptInput.onSwitchWorkspace`).

## src/components/pages/dashboard/hooks/README.md

No drift detected.

## src/components/pages/investigation/README.md

No drift detected.

## src/components/pages/investigation/components/README.md

No drift detected.

## src/components/pages/investigation/hooks/README.md

No drift detected.

## src/components/templates/README.md

No drift detected.

## src/components/ui/README.md

No drift detected.

## src/features/README.md

No drift detected.

## src/features/dashboard/README.md

No drift detected.

## src/features/dashboard/a2ui/README.md

No drift detected.

## src/features/dashboard/a2ui/components/README.md

- `## Side Effects`: Omits `useWorkspaceStore` subscriptions (`useWorkspaceStore((state) => state.activeWorkspaceId)`) in `A2UIChartArea.tsx:A2UIChartArea`, `A2UILogTable.tsx:A2UILogTable`, and `A2UIMetricCard.tsx:A2UIMetricCard` (only `activeWorkspaceId` is referenced in `## Invariants`).
- `## Invariants`: `[A2UIChartArea.tsx:A2UIChartArea]` omits that async state updates are guarded by an effect-scoped `active` flag (`let active = true` / `if (active)`), which is documented for `A2UILogTable` and `A2UIMetricCard`.

## src/features/dashboard/a2ui/utils/README.md

No drift detected.

## src/features/dashboard/components/README.md

No drift detected.

## src/features/dashboard/components/AIInsightsStudio/README.md

- `## Interface`: `[index.ts]` parenthetical notes `(AtMentionMenu and SlashCommandMenu are internal to the package)`, omitting `StudioDiagramHelperModal` (`StudioDiagramHelperModal.tsx`), which is also internal and not re-exported by `index.ts`.
- `## Invariants`: `[StudioPromptInput.tsx:StudioPromptInput]` states `onSwitchWorkspace` triggers when attaching a catalog from another workspace, omitting that selecting a `"workspace"` item in `handleSelectAtItem` also triggers `onSwitchWorkspace(item.data.workspaceId)`.
- `## Side Effects`: `[AIInsightsStudio.tsx:handleSendMessage] / [AIInsightsStudio.tsx:handleNewSession] / [AIInsightsStudio.tsx:handleDeleteSession]` lists `sendMessage`, `setDashboardSession`, and `deleteSession` from `useAiStore`, omitting `stopStream` (forwarded to `StudioPromptInput` as `onStopStream`).

## src/features/dashboard/hooks/README.md

No drift detected.

## src/features/investigation/README.md

- `## Side Effects`: `[InvestigationPage.tsx:InvestigationPageImpl]` omits `useSettingsStore` (`fetchSettings(activeWorkspaceId)`), and `[AIHistorySearchModal.tsx:AIHistorySearchModal]` omits reading `activeWorkspaceId` from `useWorkspaceStore`.

## src/features/investigation/ai-sidebar/README.md

No drift detected.

## src/features/investigation/ai-sidebar/components/README.md

No drift detected.

## src/features/investigation/ai-sidebar/utils/README.md

No drift detected.

## src/features/investigation/components/README.md

No drift detected.

## src/features/investigation/custom-parser/README.md

No drift detected.

## src/features/investigation/hooks/README.md

No drift detected.

## src/features/investigation/import-modal/README.md

No drift detected.

## src/features/investigation/import-modal/tabs/README.md

No drift detected.

## src/features/investigation/log-table/README.md

- `## Side Effects`: `[VirtualLogTable.tsx:VirtualLogTable]` omits reading `useWorkspaceStore` (`selectActiveWorkspace`) and `useIngestionStore` (`ingestingSourceIds`, `jobs`, `transitioningSourceIds`).

## src/features/investigation/log-table/components/README.md

No drift detected.

## src/features/investigation/log-table/utils/README.md

No drift detected.

## src/features/laya/README.md

No drift detected.

## src/features/laya/components/README.md

No drift detected.

## src/features/laya/modals/README.md

No drift detected.

## src/features/orchestrator/README.md

- `## Interface`: `[index.ts]` description omits `export * from "./types"` (`FusionSourceConfig`, `DiscoveryTemplate`, `OrchestratorView`, `OrchestratorHubProps`).

## src/features/orchestrator/components/README.md

No drift detected.

## src/features/settings/README.md

No drift detected.

## src/features/settings/components/README.md

No drift detected.

## src/features/settings/sections/README.md

- `## Side Effects`: `[RAGSettingsSection.tsx:RAGSettingsSection]` states it "injects/clicks `<input type="file" webkitdirectory directory multiple>` in browser", whereas `handleBrowseFolder` creates a detached `<input type="file">` via `document.createElement("input")` and calls `input.click()` without appending/injecting it into the DOM.

## src/features/settings/utils/README.md

No drift detected.

## src/features/shell/README.md

- `## Invariants`: `[CommandPalette.tsx:CommandPalette]` states it "resets search on action/close", whereas `setSearch("")` runs only inside `handleAction` when executing a command; closing `<Dialog>` via `onOpenChange` (e.g., `Escape` or backdrop click) does not reset `search`.
- `## Side Effects`: `[SystemDiagnosticConsole.tsx:SystemDiagnosticConsole]` omits reading `useHealthStore` (`health.uptime` and `health.hydration.misses` displayed in the header).
- `## Side Effects`: `[Sidebar.tsx:SidebarImpl]` cites `fetchHierarchy`, `setActiveFolder`, and `toggleSidebar` without naming the backing stores (`useWorkspaceStore` and `useUIStore`).

## src/lib/README.md

No drift detected.

## src/lib/hooks/README.md

No drift detected.

## src/lib/hooks/ingestion/README.md

No drift detected.

## src/lib/types/README.md

- `## Interface` omits the 93 exported property-level type aliases (`Jsonrpc`, `Method`, `Jsonrpc1`, `Error`, `Field`, `Value`, `Operator`, `WorkspaceId`..`WorkspaceId20`, etc. in `generated.ts` lines 38–130).
- `[generated.ts:LogLensAiAPISchema]` is described as a `"discriminated union covering all generated JSON-RPC request, response, and domain payload interfaces"`, whereas `LogLensAiAPISchema` is an undiscriminated union of 29 types and excludes the exported `Params`, `Offsets`, and `Settings` interfaces.
- `Overview` and `Invariants` state `generated.ts` is generated from the repository's JSON Schema via `json-schema-to-typescript`, whereas neither `api_schema.json` nor `sidecar/src/models.py` (required by `scripts/generate_schema.py`) exists in the repository; additionally, exported interface `Offsets` uses `[k: string]: number` rather than `[k: string]: unknown`.

## src/store/README.md

No drift detected.

## src/store/ingestion/README.md

- `## Invariants` (`Adaptive poll interval & auto-termination`) states `startPolling` sets `isPolling: false` if no workspace timers remain when `!wsActiveJob && liveSourceCount === 0`, whereas `pollingSlice.ts` evaluates `[...pollSessions.values()].some((s) => s.timer !== null)` *before* setting `currentSession.timer = null` — so after any scheduled `setTimeout` tick, `currentSession.timer` is still non-null, `anyActive` evaluates to `true`, and `isPolling` is never reset to `false`.

## src/types/README.md

No drift detected.
