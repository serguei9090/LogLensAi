# ingestion

## Overview
Log ingestion pipelines bridging local files, remote SSH `tail -f`, syslog UDP datagrams, and HTTP `/ingest` endpoints into disk-first `logstore.DiskLogStore` storage and batched DuckDB `logs` persistence, with shared-source fan-out deduplication (`SharedSourceManager`) and cached per-workspace/source metadata extraction.

## Interface
- `[ingest.go:IngestEntry]`, `[ingest.go:BatchIngester]`, `[ingest.go:DBBatchIngester]`, `[ingest.go:NewDBBatchIngester]`, `[ingest.go:DBBatchIngester.IngestBatch]`: Batch log submission struct, interface, and DuckDB + `DiskLogStore` implementation.
- `[listeners.go:Server]`, `[listeners.go:NewServer]`, `[listeners.go:Server.Running]`, `[listeners.go:Server.SyslogAddr]`, `[listeners.go:Server.RefreshStreams]`, `[listeners.go:Server.Start]`, `[listeners.go:Server.Stop]`, `[listeners.go:Server.Reconfigure]`: Configurable syslog UDP and HTTP push ingestion server exposing `POST /ingest`, `POST /ingest/{workspace_id}`, `POST /ingest/{workspace_id}/{collection_name}`, and `POST /{$}` via `[listeners.go:Server.mux]`.
- `[shared.go:LineCallback]`, `[shared.go:SharedSource]`, `[shared.go:SharedSource.Subscribe]`, `[shared.go:SharedSource.Unsubscribe]`, `[shared.go:SharedSource.PushLine]`, `[shared.go:SharedSource.PushBatch]`: Deduplicated per-source tailer and line fan-out hub.
- `[shared.go:SharedSourceManager]`, `[shared.go:NewSharedSourceManager]`, `[shared.go:SharedSourceManager.GetSource]`, `[shared.go:SharedSourceManager.Cleanup]`: Registry managing `SharedSource` lifetimes per `sourceID`.
- `[ssh.go:SSHLoader]`, `[ssh.go:NewSSHLoader]`, `[ssh.go:SSHLoader.Running]`, `[ssh.go:SSHLoader.Start]`, `[ssh.go:SSHLoader.Stop]`: Remote SSH `tail -n 0 -f` stream loader feeding a file-less `SharedSource`.
- `[tailer.go:FileTailer]`, `[tailer.go:NewFileTailer]`, `[tailer.go:FileTailer.Running]`, `[tailer.go:FileTailer.Start]`, `[tailer.go:FileTailer.Stop]`: Workspace-scoped subscriber turning tailed lines into metadata-enriched `db.LogInsertRow` micro-batches.

## Invariants
- `[batchqueue.go:microBatchQueue.push]`, `[batchqueue.go:microBatchQueue.drain]`: Protects buffered items with `q.mu`, coalesces threshold wakeups via a capacity-1 `q.wake` channel when `len(q.buf) >= q.batchSize`, and returns `nil` when empty.
- `[ingest.go:DBBatchIngester.IngestBatch]`: Defaults empty `WorkspaceID` to `"default"` and empty `SourceID` to `"manual"`, groups by `(workspaceID, sourceID)` preserving order so `logStore.AppendBatch` yields contiguous `line_id`s per source, extracts defaults with `metadata.ExtractLogMetadata` (with explicit entry `Timestamp`/`Level`/`Facets` overriding), and persists via `db.InsertLogBatch`.
- `[listeners.go:NewServer]`, `[listeners.go:Server.Start]`, `[listeners.go:Server.Stop]`, `[listeners.go:Server.Reconfigure]`: Pre-allocates the 1,000-entry `microBatchQueue`; flushes on threshold or every `1s` (`listenerFlushInterval`) plus a final flush on `Stop` (with 2s HTTP shutdown timeout); `Reconfigure` no-ops when settings match and running, otherwise stops, pauses `200ms`, and restarts.
- `[listeners.go:Server.runSyslog]`, `[listeners.go:Server.handleIngest]`, `[listeners.go:decodeIngestPayload]`: Syslog trims UDP payloads up to 64 KiB and fans out to matching enabled `syslog` streams (or `"default"`/`"syslog"`); HTTP `/ingest*` resolves `workspace_id` (`PathValue` -> `?ws=` -> `"default"`) and `source_id` (`PathValue("collection_name")` -> `?source_id=` -> `"http-ingest"`), consulting `http` streams only when `workspaceID == "default"`, accepting a JSON object or array, and falling back to `"message"` if `"raw_text"` is absent.
- `[shared.go:SharedSourceManager.GetSource]`, `[shared.go:SharedSource.Subscribe]`, `[shared.go:SharedSource.Unsubscribe]`, `[shared.go:SharedSource.runTail]`: Ensures one `SharedSource` per `sourceID` (first-writer-wins `Filepath`); starts at most one file-tailing goroutine on first subscriber when `Filepath != ""` (closing `stopCh` when subscribers hit 0); seeks to EOF and watches parent dir via `fsnotify`, falling back to `100ms` polling if watching errors; isolates subscriber callback panics via `recover()`.
- `[ssh.go:SSHLoader.Start]`, `[ssh.go:SSHLoader.Stop]`, `[ssh.go:SSHLoader.tailLoop]`, `[ssh.go:shellQuote]`: Uses `10s` dial timeout, password auth, `ssh.InsecureIgnoreHostKey()`, POSIX shell quoting, and file-less `SharedSource` (`GetSource(l.SourceID, "")`); `Stop` waits up to `2s` on `doneCh`.
- `[tailer.go:NewFileTailer]`, `[tailer.go:FileTailer.processLine]`, `[tailer.go:FileTailer.flushLoop]`, `[tailer.go:FileTailer.getParserConfig]`, `[tailer.go:FileTailer.getRules]`: Normalizes slashes in `Filepath` and defaults `SourceID` to `Filepath`; drops empty lines; flushes at 500 rows (`tailerBatchSize`) or `100ms` (`tailerFlushInterval`); caches DB parser config for `30s` and facet rules for `10s`.

## Side Effects
- `[ingest.go:DBBatchIngester.IngestBatch]`, `[shared.go:SharedSource.handleNewLine]`, `[tailer.go:FileTailer.flushBatch]`: Appends lines to `DiskLogStore` on disk and inserts log rows into DuckDB via `db.InsertLogBatch`.
- `[listeners.go:Server.*]`: Queries `db.ActiveLogStreams()`, binds UDP (`0.0.0.0:syslogPort`) and TCP (`:httpPort`) sockets, spawns flush/listener goroutines, receives UDP/HTTP requests, and logs lifecycle/network errors.
- `[shared.go:SharedSource.*]`, `[ssh.go:SSHLoader.*]`, `[tailer.go:FileTailer.*]`: Opens local files and `fsnotify` watches, dials outbound TCP/SSH connections executing `tail -n 0 -f`, queries `db.FusionParserConfig` and `db.FacetExtractionRulesJSON`, spawns background goroutines, and writes diagnostic logs via `log.Printf`.

## Verification
- Run: `go test ./...`
