# graph

## Overview
Hand-written AI investigation state machine (`reasoning` -> `tool_execution` -> `final_answer`), OpenAI-compatible `ToolRegistry` with 9 built-in log/memory/rule tools, smart log context condensation, preflight workspace inventory grounding, and reasoning-block (`<think>`) normalization.

## Interface
- `[state.go:NodeReasoning]`, `[state.go:NodeToolExecution]`, `[state.go:NodeFinalAnswer]`: Canonical state machine node identifiers (`"reasoning"`, `"tool_execution"`, `"final_answer"`).
- `[state.go:MissionState]`: Execution state struct (`WorkspaceID`, `SessionID`, `Messages`, `Model`, `Reasoning`, `NextNode`, `Status`, `Metadata`).
- `[graph.go:StreamChunk]`: Output event struct (`Content`, `Err`, `EvaluationNotice`, `StepNotice`, `StepDone`).
- `[graph.go:Run]`: Launches the asynchronous reasoning/tool loop over a `Provider` and `*ToolRegistry`, streaming `StreamChunk` updates until completion or cancellation.
- `[tools.go:ToolFunc]`, `[tools.go:ToolRegistry]`, `[tools.go:NewToolRegistry]`, `[tools.go:ToolRegistry.App]`, `[tools.go:ToolRegistry.Register]`, `[tools.go:ToolRegistry.Schemas]`, `[tools.go:ToolRegistry.Execute]`, `[tools.go:ToolRegistry.Has]`: Order-preserving tool registry with 9 built-in tools (`search_logs`, `get_log_timeline`, `get_clusters`, `search_memory`, `search_knowledge`, `get_facets`, `get_hierarchy`, `create_column`, `create_facet`).
- `[context.go:LogEntry]`, `[context.go:SmartContextManager]`, `[context.go:NewSmartContextManager]`, `[context.go:SmartContextManager.FilterLogs]`, `[context.go:SmartContextManager.SummarizeLogs]`, `[context.go:SmartContextManager.PrepareLogContext]`: Log filtering, cluster repetition collapsing, and token-budget truncation.
- `[preflight.go:CatalogSource]`, `[preflight.go:ErrorLogSnippet]`, `[preflight.go:ClusterTriageSummary]`, `[preflight.go:WorkspaceInventory]`, `[preflight.go:InspectWorkspace]`, `[preflight.go:WorkspaceInventory.FormatGroundedSystemPromptContext]`: Preflight DuckDB inventory inspection and grounded prompt formatting.
- `[reasoning.go:ThinkOpen]`, `[reasoning.go:ThinkClose]`, `[reasoning.go:ParseReasoningBlocks]`, `[reasoning.go:ExtractThinkingContent]`: Reasoning tag/channel normalization and `<think>` block extraction.
- `[types.go:ChatMessage]`, `[types.go:ToolCall]`, `[types.go:ToolCallFunction]`, `[types.go:ToolSchema]`, `[types.go:ToolFunctionSchema]`, `[types.go:MemoryResult]`, `[types.go:KnowledgeHit]`, `[types.go:Provider]`, `[types.go:MemorySearcher]`: Wire types and provider/RAG interfaces consumed by the graph loop.

## Invariants
- `[graph.go:Run]`: Rejects `provider == nil` immediately; bounds execution to `maxIterations` (`25`); honors `ctx.Done()` before iterations and channel sends; prepends A2UI, reasoning/action, and workspace-grounding system directives before the first non-empty user message on iteration `0`.
- `[graph.go:nodeReasoning]`, `[graph.go:nodeToolExecution]`, `[graph.go:executeToolCall]`: Transitions to `NodeToolExecution` when `ToolCalls` is non-empty or `response.Content` contains `"TOOL_CALL:"`, otherwise `NodeFinalAnswer`; recovers panics inside `tools.Execute` and isolates per-tool failures into `{"error": ...}` tool messages; normalizes output via `ParseReasoningBlocks` and emits a fallback answer if non-tool completion content is empty.
- `[tools.go:NewToolRegistry]`, `[tools.go:ToolRegistry.Register]`, `[tools.go:ToolRegistry.Schemas]`, `[tools.go:ToolRegistry.Execute]`: Registers the 9 built-in tools in deterministic order; overwrites by name preserve first-registration order without mutex synchronization; missing tool names return `map[string]any{"error": ...}` with `nil` Go error.
- `[tools_query.go:ToolRegistry.searchLogs]`, `[tools_query.go:ToolRegistry.getLogTimeline]`, `[tools_query.go:ToolRegistry.getFacets]`, `[tools_query.go:ToolRegistry.getClusters]`, `[tools_query.go:ToolRegistry.getHierarchy]`, `[tools_rules.go:ToolRegistry.searchMemory]`, `[tools_rules.go:ToolRegistry.searchKnowledge]`: Surface invalid arguments and backend errors as `"error"` map/slice values with `nil` Go error; `searchMemory`/`searchKnowledge` fix limit at `5`; `getHierarchy` roots orphan folders/sources under synthetic `"root"`.
- `[tools_rules.go:ToolRegistry.createColumn]`, `[tools_rules.go:ToolRegistry.createFacet]`, `[tools_rules.go:ToolRegistry.readDrainMasksSetting]`, `[tools_rules.go:ToolRegistry.writeDrainMasksSetting]`: `createColumn` emits `[[A2UI]]{"type": "add_column", ...}[[/A2UI]]` without DB mutation; `createFacet` accepts array or double-encoded string `drain_masks`, updates matching `(Label, Pattern)` or appends, and upserts `workspace_settings` (when `workspaceID != ""`) or `settings`.
- `[context.go:SmartContextManager.PrepareLogContext]`, `[context.go:SmartContextManager.SummarizeLogs]`: Defaults `maxTokens <= 0` to `4000` and nil `keepLevels` to `INFO/WARN/ERROR/FATAL/CRITICAL`, collapses repeated cluster IDs exceeding `3`, falls back to `logs[:20]` if level filtering yields empty, and truncates beyond `int(float64(maxTokens) * 3.5)` bytes.
- `[preflight.go:InspectWorkspace]`, `[preflight.go:resolveWorkspaceID]`: Requires non-nil `a.DB.Conn`; maps `"default"`/`"default-ws"`/`"default workspace"` (or empty) to `"default-ws"`, uppercases levels (`""` -> `"UNKNOWN"`), caps `RecentErrors` at `5` and `ClusterTriages` at `8`, and ignores individual query/scan errors.
- `[reasoning.go:ParseReasoningBlocks]`, `[reasoning.go:ExtractThinkingContent]`: Normalizes `[reasoning]`, `<thought>`, and channel markers into `<think>...</think>` and extracts the first `<think>` block.

## Side Effects
- `[graph.go:Run]`, `[graph.go:nodeReasoning]`, `[graph.go:nodeToolExecution]`: Spawns a goroutine writing to and closing `<-chan StreamChunk`, issues LLM RPC calls via `Provider.Chat`, emits `StepNotice`/`StepDone` chunks, and invokes tool handlers.
- `[preflight.go:InspectWorkspace]`, `[preflight.go:resolveWorkspaceID]`, `[tools_query.go:ToolRegistry.getHierarchy]`, `[tools_rules.go:ToolRegistry.readDrainMasksSetting]`, `[tools_rules.go:ToolRegistry.writeDrainMasksSetting]`: Executes SQL reads against DuckDB tables (`log_sources`, `logs`, `cluster_triage`, `folders`, `settings`, `workspace_settings`) and upserts `drain_masks` into `workspace_settings` or `settings`.
- `[tools_query.go:*]`, `[tools_rules.go:ToolRegistry.searchMemory]`, `[tools_rules.go:ToolRegistry.searchKnowledge]`: Invokes `*app.App` query/distribution/cluster/facet handlers and `MemorySearcher` vector search methods.

## Verification
- Run: `go test ./...`
