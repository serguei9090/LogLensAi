# clustering

## Overview
Background "train-then-tag" log clustering service. Polls DuckDB for unprocessed log rows, hydrates missing raw text through `LineHydrator`, extracts messages and metadata via `MetadataExtractor`, trains each workspace's `drain3.Miner` sequentially on a bounded sample before tagging remaining rows in parallel across a goroutine pool, and persists batched log updates, cluster counts, and ingestion-job progress.

## Interface
- `[interfaces.go:LineHydrator]`: Interface (`GetLines(sourceID string, lineIDs []int64) (map[int64]string, error)`) for resolving raw log text by `(sourceID, lineID)`.
- `[interfaces.go:ExtractedMetadata]`: Struct (`Message`, `Timestamp`, `Level`, `Facets map[string]string`) returned by metadata extraction.
- `[interfaces.go:MetadataExtractor]`: Interface (`Extract(workspaceID, sourceID, rawText string, existingFacets map[string]string) (ExtractedMetadata, error)`).
- `[interfaces.go:DefaultMetadataExtractor]`: Placeholder `MetadataExtractor` passing raw text through unchanged (`[interfaces.go:DefaultMetadataExtractor.Extract]`).
- `[interfaces.go:MinerProvider]`: Function type `func(workspaceID string) (*drain3.Miner, error)` resolving the `drain3.Miner` per workspace.
- `[metadata_adapter.go:MetadataConfigResolver]`: Interface (`RulesFor`, `ParserConfigFor`) supplying per-workspace extraction rules and per-source parser configuration.
- `[metadata_adapter.go:NewMetadataAdapter]`: Adapts `metadata.ExtractLogMetadata` and a `MetadataConfigResolver` into a `MetadataExtractor`.
- `[worker.go:TrainSampleSize]`: Constant `200` controlling maximum rows trained sequentially per batch.
- `[worker.go:Mode]`, `[worker.go:ModeAuto]`, `[worker.go:ModeBurst]`: Worker scheduling modes (`"auto"`, `"burst"`).
- `[worker.go:Status]`: Struct (`Mode`, `Running`, `Paused`, `Backlog`, `ProcessedSession`) returned by `Worker.GetStatus`.
- `[worker.go:ClusterTriageHandler]`: Interface (`TriageClustersAsync(workspaceID string, templates map[string]string)`) for asynchronous template triage.
- `[worker.go:Worker]`, `[worker.go:NewWorker]`, `[worker.go:Worker.SetTriageHandler]`, `[worker.go:Worker.Start]`, `[worker.go:Worker.Stop]`, `[worker.go:Worker.GetStatus]`, `[worker.go:Worker.SetMode]`, `[worker.go:Worker.SetPaused]`: Lifecycle, mode/pause controls, status reporting, and triage handler wiring.

## Invariants
- `[worker.go:NewWorker]`: Defaults `batchSize <= 0` to `500`, `interval <= 0` to `2 * time.Second`, `poolSize <= 0` to `max(1, runtime.NumCPU()-1)`, and `metadata == nil` to `DefaultMetadataExtractor{}`.
- `[worker.go:Worker.Start]`, `[worker.go:Worker.Stop]`: `Start` is idempotent while running; `Stop` closes `stopCh` and blocks on `doneCh` until the loop exits.
- `[worker.go:Worker.SetMode]`: Accepts `ModeAuto`, `ModeBurst`, or deprecated `"manual"` (mapped to `ModeAuto` with `paused = true`); rejects unknown modes with an error.
- `[batch.go:Worker.processBatch]`, `[batch.go:Worker.trainRows]`, `[batch.go:Worker.tagRowsParallel]`: Runs sequential tree-mutating `miner.Train` on up to `TrainSampleSize` (200) rows before launching read-only `miner.Match` across `poolSize` goroutines; `clusterIncrements` and `batchCounts` map writes remain single-threaded.
- `[batch.go:Worker.hydrateBatch]`: Rows without `RawText` that have invalid `LineID`, `hydrator == nil`, hydration errors, or empty/absent hydrated strings are marked `Level = "MISSING"` with `FacetsJSON = "{}"` without cross-cycle retry; miner/extraction failures are marked `Level = "ERROR"` preserving existing facets JSON.
- `[batch.go:Worker.tagOne]`: Rows extracted without error that fail to match any Drain3 cluster still produce a processed update (null `ClusterID`) and increment `batchCounts`, omitting `clusterIncrements`.
- `[metadata_adapter.go:metadataAdapter.Extract]`: Existing persisted facets take precedence over newly extracted facets on key collisions.

## Side Effects
- `[worker.go:Worker.Start]`, `[batch.go:Worker.tagRowsParallel]`: Spawns the background `run` goroutine and per-batch worker-pool goroutines; mutates `Worker.mu`-guarded worker state (`running`, `paused`, `mode`, `forceCycle`, `processedSession`, `triageHandler`).
- `[batch.go:Worker.processBatch]`, `[batch.go:Worker.applyResults]`, `[worker.go:Worker.GetStatus]`: Queries and mutates DuckDB via `w.db.SelectUnprocessedLogs`, `w.db.CountUnprocessedLogs`, `w.db.ApplyClusteringBatch`, and `w.db.UpdateIngestionJobProgress`; calls `w.hydrator.GetLines` and mutates `drain3.Miner` state during `Train`.
- `[batch.go:Worker.applyResults]`: Dispatches `triageHandler.TriageClustersAsync` per workspace for non-empty templates when a `ClusterTriageHandler` is registered.
- `[batch.go:Worker.hydrateBatch]`, `[worker.go:Worker.run]`: Logs hydration and cycle errors via `log.Printf`.

## Verification
- Run: `go test ./...`
