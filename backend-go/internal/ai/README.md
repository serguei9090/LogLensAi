# ai

## Overview
Phase 3 AI composition root reconciling `internal/ai/providers`, `internal/ai/rag`, and `internal/ai/graph` against `*app.App` without introducing an `internal/app` <-> `internal/ai/graph` import cycle. Provides startup-safe AI wiring (`Wire`), dynamic settings-backed provider adaptation, lazy ONNX/DuckDB-VSS memory search, and extra AI/RAG/knowledge RPC handlers (`Extra`).

## Interface
- `[wiring.go:Wiring]`: Bundle struct (`Provider graph.Provider`, `Tools *graph.ToolRegistry`, `Memory graph.MemorySearcher`) consumed by RPC registration (`rpc.RegisterAI`, `rpc.MountStreamChat`).
- `[wiring.go:Wire]`: Startup wiring constructor building a dynamic `graph.Provider`, lazy `graph.MemorySearcher`, and `*graph.ToolRegistry` from `*app.App`.
- `[wiring.go:NewProviderFromSettings]`: Constructs a `providers.Provider` from `a.Settings("")` (defaulting `ai_provider` to `"ollama"`).
- `[wiring.go:NewProviderAdapter]`: Wraps a static `providers.Provider` as a `graph.Provider`.
- `[wiring.go:NewDynamicProviderAdapter]`: Wraps `*app.App` and a fallback `providers.Provider` as a `graph.Provider` that refreshes settings dynamically per `Chat` call.
- `[rpc_extra.go:ClusterMemorySearcher]`: Interface (`SearchMemory(ctx context.Context, workspaceID, query string, limit int) ([]rag.MemoryResult, error)`) for cluster RAG pre-checks.
- `[rpc_extra.go:DefaultClusterMemorySimilarityThreshold]`: Constant `0.70` similarity threshold separating `KNOWN ISSUE` from `NEW ANOMALY`.
- `[rpc_extra.go:TagKnownIssue]`, `[rpc_extra.go:TagNewAnomaly]`: Display classification tag constants for analyzed clusters.
- `[rpc_extra.go:Extra]`, `[rpc_extra.go:NewExtra]`, `[rpc_extra.go:Extra.SetMemorySearcher]`, `[rpc_extra.go:Extra.AnalyzeCluster]`, `[rpc_extra.go:Extra.ListModels]`, `[rpc_extra.go:Extra.TestConnection]`, `[rpc_extra.go:Extra.GenerateFacetRegex]`, `[rpc_extra.go:Extra.SaveMemory]`, `[rpc_extra.go:Extra.SearchMemory]`, `[rpc_extra.go:Extra.SyncKnowledgeBase]`, `[rpc_extra.go:Extra.GetRAGModelStatus]`, `[rpc_extra.go:Extra.DownloadRAGModel]`, `[rpc_extra.go:Extra.DeleteRAGModel]`: Handlers for standalone AI, cluster RAG analysis, memory, knowledge sync, and RAG model management RPC methods.
- Subdirectories:
  - `graph`: [./graph/README.md](./graph/README.md) — AI investigation state machine, 9-tool registry, context condensation, and preflight workspace grounding.
  - `laya`: [./laya/README.md](./laya/README.md) — Local Laya System 1 ModernBERT ONNX decision engine, tokenizer, downloader, and versioned checkpoint rule manager.
  - `providers`: [./providers/README.md](./providers/README.md) — Ollama, OpenAI-compatible, and Gemini LLM clients and factory.
  - `rag`: [./rag/README.md](./rag/README.md) — ONNX `nomic-embed-text-v1.5` embedder, DuckDB vector memory/knowledge store, watcher, downloader, and Markdown exporter.

## Invariants
- `[wiring.go:Wire]`, `[rpc_extra.go:NewExtra]`: Perform zero network or ONNX model I/O at startup; defer `rag.NewEmbedderFromEnv` and `rag.NewService` initialization behind `sync.Once` (`lazyMemorySearcher` and `lazyMemoryService`), caching any initialization error permanently so broken environments fail fast.
- `[wiring.go:NewProviderFromSettings]`, `[wiring.go:providerAdapter.getProvider]`, `[rpc_extra.go:Extra.getProvider]`: Default empty `ai_provider` to `"ollama"` and map provider-specific API keys and hosts from settings; dynamic adapters reload settings per request unless `Extra.isExplicitProvider` is true.
- `[wiring.go:toProviderMessage]`, `[wiring.go:toGraphMessage]`, `[wiring.go:toProviderToolSchema]`: Translate field-for-field between `graph` and `providers` types, dropping provider-only `ContextLogs`/`Timestamp`/`ProviderSessionID` and normalizing empty tool `Arguments` to `"{}"`.
- `[wiring.go:lazyMemorySearcher.SearchMemory]`: Maps `rag.MemoryResult.Distance` to similarity `1 - m.Distance`.
- `[rpc_extra.go:Extra.AnalyzeCluster]`: Defaults `sampleSize <= 0` to `20` and invalid `SimilarityThreshold` values to `0.70`; resolves cluster template from Drain3 or `DB.GetClusterTriage`; classifies `sim >= threshold` as `KNOWN ISSUE` (enriching the prompt and prepending proven resolution/root-cause hints) vs `NEW ANOMALY`; persists RAG classification via `DB.UpsertClusterRAGTag`.
- `[rpc_extra.go:Extra.GenerateFacetRegex]`: Strips markdown fences and `"python"`/`"regex"` prefixes, requires valid RE2 compilation and parentheses, and falls back to `"(" + regexp.QuoteMeta(req.SelectedText) + ")"` on failure.
- `[rpc_extra.go:Extra.SearchMemory]`, `[rpc_extra.go:Extra.SyncKnowledgeBase]`: `SearchMemory` defaults `limit <= 0` to `5`; `SyncKnowledgeBase` defaults empty `KnowledgePath` to `"knowledge"` and closes its `rag.KnowledgeWatcher` via `defer watcher.Stop()`.

## Side Effects
- `[wiring.go:lazyMemorySearcher.init]`, `[rpc_extra.go:lazyMemoryService.get]`: On first memory/knowledge use, resolves/downloads ONNX Runtime and `nomic-embed-text-v1.5` assets (`rag.NewEmbedderFromEnv`), runs `rag.NewService` (DuckDB vector setup), and logs initialization failures via `log.Printf`.
- `[wiring.go:providerAdapter.Chat]`, `[rpc_extra.go:Extra.AnalyzeCluster]`, `[rpc_extra.go:Extra.ListModels]`, `[rpc_extra.go:Extra.TestConnection]`, `[rpc_extra.go:Extra.GenerateFacetRegex]`: Reads `a.Settings("")` and issues outbound LLM API requests through `providers.Provider`.
- `[rpc_extra.go:Extra.AnalyzeCluster]`, `[rpc_extra.go:Extra.SaveMemory]`, `[rpc_extra.go:Extra.SearchMemory]`, `[rpc_extra.go:Extra.SyncKnowledgeBase]`: Reads/writes DuckDB (`logs`, `cluster_triage`, `ai_memory`), fetches raw lines via `e.app.FastPath.GetLine`, and walks/ingests local knowledge directories via `rag.NewKnowledgeWatcher`.
- `[rpc_extra.go:Extra.DownloadRAGModel]`, `[rpc_extra.go:Extra.DeleteRAGModel]`: Starts background Hugging Face downloads or removes cached `rag_model` files on disk via `rag.ModelManager`.

## Verification
- Run: `go test ./...`
