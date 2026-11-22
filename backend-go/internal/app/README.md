# app

## Overview
Application composition root (`App`) and JSON-RPC domain handler implementations. Owns the lifecycle of DuckDB (`*db.DB`), disk log storage (`*logstore.DiskLogStore`), fast-path mmap hydration (`*logstore.FastPathService`), shared source fan-out (`*ingestion.SharedSourceManager`), active `FileTailer`/`SSHLoader` ingestors, per-workspace Drain3 miners, the background `clustering.Worker`, and Laya System 1 triage (`LayaClusterTriager`).

## Interface
- Composition root & triage (`app.go`, `app_drain.go`, `app_metadata.go`, `laya_triage.go`):
  - `[app.go:App]`, `[app.go:NewApp]`, `[app.go:App.ReloadLayaEngine]`, `[app.go:App.Close]`, `[app.go:App.DataDir]`
  - `[app_drain.go:App.GetDrainParser]`
  - `[app_metadata.go:App.Settings]`
  - `[laya_triage.go:LayaClusterTriager]`, `[laya_triage.go:NewLayaClusterTriager]`, `[laya_triage.go:LayaClusterTriager.TriageClustersAsync]`
- AI sessions, anomalies, clusters, & dashboard (`handlers_ai_sessions.go`, `handlers_anomalies.go`, `handlers_cluster.go`, `handlers_dashboard.go`):
  - `[handlers_ai_sessions.go:App.GetAISessions]`, `[handlers_ai_sessions.go:App.GetAIMessages]`, `[handlers_ai_sessions.go:App.RenameAISession]`, `[handlers_ai_sessions.go:App.DeleteAISession]`, `[handlers_ai_sessions.go:App.GetAIMapping]`
  - `[handlers_anomalies.go:App.GetAnomalies]`
  - `[handlers_cluster.go:App.GetClusters]`, `[handlers_cluster.go:App.GetClusteringStatus]`, `[handlers_cluster.go:App.SetClusteringMode]`, `[handlers_cluster.go:App.SetClusteringPaused]`
  - `[handlers_dashboard.go:App.GetDashboardStats]`
- Hierarchy, ingestion, Laya, & log sources (`handlers_hierarchy.go`, `handlers_ingest.go`, `handlers_laya.go`, `handlers_logsources.go`):
  - `[handlers_hierarchy.go:App.GetHierarchy]`, `[handlers_hierarchy.go:App.CreateFolder]`, `[handlers_hierarchy.go:App.UpdateFolder]`, `[handlers_hierarchy.go:App.DeleteFolder]`, `[handlers_hierarchy.go:App.MoveSource]`
  - `[handlers_ingest.go:App.IngestLogs]`, `[handlers_ingest.go:App.IngestLocalFile]`
  - `[handlers_laya.go:App.GetLayaSettings]`, `[handlers_laya.go:App.UpdateLayaSettings]`, `[handlers_laya.go:App.GetLayaCheckpoints]`, `[handlers_laya.go:App.RollbackLayaCheckpoint]`, `[handlers_laya.go:App.SaveLayaRules]`, `[handlers_laya.go:App.TestLayaRule]`, `[handlers_laya.go:App.GetLayaModelStatus]`, `[handlers_laya.go:App.DownloadLayaModel]`, `[handlers_laya.go:App.DeleteLayaModel]`
  - `[handlers_logsources.go:App.CreateLogSource]`, `[handlers_logsources.go:App.UpdateLogSource]`, `[handlers_logsources.go:App.DeleteLogSource]`, `[handlers_logsources.go:App.GetWorkspaceSources]`, `[handlers_logsources.go:App.GetTimeBoundaries]`
- Querying, health, settings, tailing, lifecycle, & log operations (`handlers_misc.go`, `handlers_query.go`, `handlers_settings.go`, `handlers_tail.go`, `handlers_workspace_lifecycle.go`, `handlers_logops_*.go`):
  - `[handlers_misc.go:App.GetHealth]`
  - `[handlers_query.go:App.GetLogs]`, `[handlers_query.go:App.GetMetadataFacets]`, `[handlers_query.go:App.GetLogContent]`
  - `[handlers_settings.go:App.GetSettings]`, `[handlers_settings.go:App.UpdateSettings]`, `[handlers_settings.go:App.ResetWorkspaceSettings]`, `[handlers_settings.go:App.SaveTemplate]`, `[handlers_settings.go:App.GetTemplates]`, `[handlers_settings.go:App.DeleteTemplate]`, `[handlers_settings.go:App.ResetTemplates]`, `[handlers_settings.go:App.GetLogStreams]`, `[handlers_settings.go:App.CreateLogStream]`, `[handlers_settings.go:App.DeleteLogStream]`, `[handlers_settings.go:App.UpdateTemporalOffsets]`, `[handlers_settings.go:App.GetTemporalOffsets]`
  - `[handlers_tail.go:App.StartTail]`, `[handlers_tail.go:App.StopTail]`, `[handlers_tail.go:App.IsTailing]`
  - `[handlers_workspace_lifecycle.go:App.DeleteWorkspace]`, `[handlers_workspace_lifecycle.go:App.PurgeInactiveWorkspaces]`, `[handlers_workspace_lifecycle.go:App.FactoryReset]`
  - `[handlers_logops_distribution.go:App.GetLogDistribution]`
  - `[handlers_logops_export.go:App.DeleteLogs]`, `[handlers_logops_export.go:App.ExportLogs]`
  - `[handlers_logops_fusion.go:App.UpdateSourceParser]`, `[handlers_logops_fusion.go:App.GetFusionConfig]`, `[handlers_logops_fusion.go:App.UpdateFusionConfig]`, `[handlers_logops_fusion.go:App.GetFusedLogs]`
  - `[handlers_logops_jobs.go:App.StartSSHTail]`, `[handlers_logops_jobs.go:App.LogTrace]`, `[handlers_logops_jobs.go:App.CleanupIngestionJobs]`, `[handlers_logops_jobs.go:App.GetIngestionJobs]`
  - `[handlers_logops_sampling.go:App.GetSampleLines]`, `[handlers_logops_sampling.go:App.GetSampleLogs]`, `[handlers_logops_sampling.go:App.UpdateLogComment]`, `[handlers_logops_sampling.go:App.ReadFile]`

## Invariants
- `[app.go:NewApp]`, `[app.go:App.Close]`, `[app.go:resolveDataDir]`, `[app.go:App.ReloadLayaEngine]`: Resolves `dataDir` to `"data"` for `:memory:` DBs or `filepath.Dir(dbPath)`, configures `<dataDir>/storage`, `<dataDir>/drain`, `<dataDir>/laya_rules.json`, and `<dataDir>/models/laya`, enables `FallbackToMock=true` on `laya.ONNXEngine`, starts `clustering.Worker` with `batchSize = 5000`, and on `Close()` stops tailers -> stops `Cluster` -> saves Drain3 miners -> cleans `Shared` -> closes `FastPath`/`LogStore`/`LayaEngine`/`DB`.
- `[app_drain.go:App.GetDrainParser]`, `[app_metadata.go:App.getSettings]`: Scopes Drain3 miners under `minersMu` (`"__global__"` when `drain_template_scope` is empty/`"global"` or `workspaceID == ""`, else `workspaceID`) and merges global settings with `workspace_settings` overrides.
- `[laya_triage.go:LayaClusterTriager.TriageClustersAsync]`, `[laya_triage.go:LayaClusterTriager.processTemplates]`: Deduplicates `"workspaceID:clusterID"` -> template under `seenMu`, bounds concurrent Laya predictions to `4` via `sem`, enforces a `2m` batch timeout, and falls back to baseline questions if `"category"`/`"severity"`/`"is_outage"` are absent.
- `[handlers_anomalies.go:App.detectAnomalies]`: Throttles per `(App, workspaceID)` to once per `10s`, clamps baseline `stddev_pop` to `0.1` over `[refTime-24h, refTime-10m)`, scales 10m rates by `6.0`, and flags anomalies only when `z > 3.0 && current_rate > 5.0`.
- `[handlers_dashboard.go:App.GetDashboardStats]`, `[handlers_logops_distribution.go:App.GetLogDistribution]`: Use identical 11-tier bucket intervals (`1 second` to `30 days`), floor slots to UTC Unix epoch multiples capped at `500` slots, zero-fill `["DEBUG", "INFO", "WARN", "ERROR"]`, and short-circuit on empty active `sourceIDs` or `fusion_configs` sets; `fetchLatestInsight` strips `<think>` tags and truncates at `150` runes.
- `[handlers_query.go:parseFilters]`, `[handlers_query.go:App.getLogsInternal]`, `[handlers_query.go:App.hydrateLog]`, `[handlers_query.go:App.GetMetadataFacets]`: Always filter by `l.workspace_id = ?`; restrict filters to `allowedFilterFields`/`facets.<key>` and sort fields to `allowedSortFields`; map `source_id` `equals` to `ILIKE`; hydrate missing raw text via `FastPath.GetLine` (falling back to `"<Missing log content>"`); apply `temporal_offsets`; aggregate facets only from static base keys and `FacetExtractionRulesJSON`.
- `[handlers_ingest.go:App.IngestLogs]`, `[handlers_ingest.go:App.IngestLocalFile]`, `[handlers_tail.go:App.StartTail]`, `[handlers_tail.go:App.StopTail]`, `[handlers_logops_jobs.go:App.StartSSHTail]`: Never share `tailersMu` locks across `Start()`/`Stop()` calls; `IngestLocalFile` streams multiline records in `20000`-row chunks (`ingestChunkSize`), short-circuiting if `sourceIsUploaded` is true; `StartSSHTail` defaults port to `22` and deduplicates `SSHLoader` instances per `(*App, "ingestor:ssh:" + effSourceID)`.
- `[handlers_hierarchy.go:App.GetHierarchy]`, `[handlers_logsources.go:App.DeleteLogSource]`, `[handlers_workspace_lifecycle.go:App.DeleteWorkspace]`, `[handlers_workspace_lifecycle.go:App.PurgeInactiveWorkspaces]`, `[handlers_workspace_lifecycle.go:App.FactoryReset]`: `GetHierarchy` attaches orphan folders/sources to synthetic `"root"`; `DeleteLogSource` removes DB rows transactionally before deleting physical files; `PurgeInactiveWorkspaces` rejects empty `ActiveWorkspaceIDs`; `FactoryReset` tears down all workers/handles, deletes on-disk files, and re-initializes the stack.
- `[handlers_settings.go:App.UpdateSettings]`, `[handlers_settings.go:App.ResetTemplates]`, `[handlers_laya.go:*]`, `[handlers_logops_export.go:*]`, `[handlers_logops_fusion.go:*]`, `[handlers_logops_sampling.go:*]`: `UpdateSettings` invalidates cached Drain3 miners only when a key has prefix `"drain_"`; `ResetTemplates` deletes Drain3 state files without touching `settings_templates`; `ExportLogs` writes CSV/JSON up to `1000000` rows; `GetSampleLogs` samples from at most `200` rows and clamps limit to `[1, 50]`; `UpdateLogComment` updates by `log_id` without workspace scoping.

## Side Effects
- `[app.go:NewApp]`, `[app.go:App.ReloadLayaEngine]`, `[app.go:App.Close]`, `[handlers_workspace_lifecycle.go:App.FactoryReset]`: Open/close/delete DuckDB files, `<dataDir>/storage`, `<dataDir>/drain/*.state`, and `<dataDir>/laya_rules.json`, initialize/destroy Laya ONNX/Mock engines, and start/stop `clustering.Worker` and tailers.
- `[app_drain.go:App.GetDrainParser]`, `[handlers_settings.go:App.ResetTemplates]`, `[handlers_ingest.go:App.IngestLocalFile]`, `[handlers_logops_export.go:App.ExportLogs]`, `[handlers_logops_jobs.go:App.LogTrace]`, `[handlers_logops_sampling.go:App.ReadFile]`, `[handlers_laya.go:*]`: Read/write/delete Drain3 state files, log files, CSV/JSON exports, `ingestion_trace.log`, and Hugging Face Laya model weights on disk/network.
- `[laya_triage.go:LayaClusterTriager.*]`, `[handlers_anomalies.go:App.detectAnomalies]`, `[handlers_tail.go:*]`, `[handlers_logops_jobs.go:App.StartSSHTail]`: Spawn background triage goroutines, `FileTailer` goroutines, and `SSHLoader` connections, mutating `a.tailers`, `seenTmpls`, `anomalyLastRun`, and `sshIngestors`.
- `[handlers_*.go]`: Execute SQL queries and mutations across DuckDB tables (`logs`, `clusters`, `cluster_triage`, `hourly_cluster_counts`, `anomalies`, `folders`, `log_sources`, `ingestion_jobs`, `settings`, `workspace_settings`, `settings_templates`, `log_streams`, `temporal_offsets`, `fusion_configs`, `ai_sessions`, `ai_messages`, `ai_memory`) and push/delete lines in `LogStore`, `FastPath`, and `Shared`.

## Verification
- Run: `go test ./...`
