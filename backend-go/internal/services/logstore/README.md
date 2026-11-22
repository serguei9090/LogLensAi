# logstore

## Overview
Disk-first log persistence and memory-mapped fast-path read service. Each source writes raw lines to an append-only `<safe-name>.log` file alongside a little-endian `uint64` byte-offset `<safe-name>.index` file and an in-memory bounded hot buffer, allowing DuckDB to store `(source_id, line_id)` references while `FastPathService` serves O(1) random-access line lookups.

## Interface
- `[fastpath.go:ErrSourceNotMapped]`: Sentinel error when a source lacks `.log`/`.index` files.
- `[fastpath.go:ErrLineNotFound]`: Sentinel error when a `lineID` cannot be resolved from the mapped index/log.
- `[fastpath.go:LineHydrator]`: Interface (`GetLine(sourceID string, lineID int64) (string, error)`, `GetLines(sourceID string, lineIDs []int64) (map[int64]string, error)`).
- `[fastpath.go:FastPathService]`, `[fastpath.go:NewFastPathService]`, `[fastpath.go:FastPathService.GetLine]`, `[fastpath.go:FastPathService.GetLines]`, `[fastpath.go:FastPathService.HydrateMisses]`, `[fastpath.go:FastPathService.CloseAll]`: Mmap-backed line reader, miss counter, and lifecycle cleanup.
- `[store.go:HotLine]`: Struct (`ID int64`, `Text string`) representing a hot-buffer entry.
- `[store.go:SourceFileHandle]`, `[store.go:SourceFileHandle.WriteLine]`, `[store.go:SourceFileHandle.WriteBatch]`, `[store.go:SourceFileHandle.HotBuffer]`, `[store.go:SourceFileHandle.LineCount]`, `[store.go:SourceFileHandle.Close]`: Per-source mutex-guarded append handle and recent-line buffer.
- `[store.go:DiskLogStore]`, `[store.go:NewDiskLogStore]`, `[store.go:DiskLogStore.FilePath]`, `[store.go:DiskLogStore.IndexPath]`, `[store.go:DiskLogStore.AppendLine]`, `[store.go:DiskLogStore.AppendBatch]`, `[store.go:DiskLogStore.GetHotBuffer]`, `[store.go:DiskLogStore.GetHandle]`, `[store.go:DiskLogStore.CloseAll]`, `[store.go:DiskLogStore.DeleteSourceFiles]`: Disk storage registry and file management.

## Invariants
- `[safename.go:safeName]`, `[store.go:DiskLogStore.FilePath]`, `[store.go:DiskLogStore.IndexPath]`, `[fastpath.go:FastPathService.getSource]`: Source identifiers are sanitized identically on write and read by replacing characters outside `[A-Za-z0-9_-]` with `_` and truncating to 64 characters.
- `[store.go:newSourceFileHandle]`, `[store.go:ensureIndex]`, `[store.go:validateIndex]`, `[store.go:rebuildIndex]`: Companion `.index` files maintain `N+1` little-endian `uint64` offsets for `N` lines (`index[0] == 0`, final entry `== logSize`); stale or corrupt indexes are incrementally resumed or rebuilt from `.log` on open, and orphan `.index` files without a `.log` file are removed.
- `[store.go:SourceFileHandle.WriteBatch]`, `[store.go:trimTrailingNewline]`, `[store.go:SourceFileHandle.pushHot]`: Strips trailing `\r`/`\n`, writes `\n`-delimited lines, rejects writes once `closed`, and caps `hotBuffer` at `hotBufferCap` (`1000`) entries.
- `[fastpath.go:mappedSource.ensureMapped]`, `[fastpath.go:mappedSource.getLine]`: Debounces `os.Stat` growth checks by `remapDebounce` (`100ms`), closes/reopens `mmap.ReaderAt` views on growth, and validates non-negative `lineID`, index bounds (`startPos+16 <= idxMmap.Len()`), and offset ordering (`0 <= startOffset <= endOffset <= logMmap.Len()`).

## Side Effects
- `[store.go:NewDiskLogStore]`, `[store.go:DiskLogStore.GetHandle]`, `[store.go:SourceFileHandle.WriteBatch]`, `[store.go:rebuildIndex]`, `[store.go:DiskLogStore.DeleteSourceFiles]`: Creates `storageDir` (`os.MkdirAll`), creates/appends/truncates/removes `<safe>.log` and `<safe>.index` files on disk, and maintains open `*SourceFileHandle` instances in `DiskLogStore.registry`.
- `[fastpath.go:FastPathService.getSource]`, `[fastpath.go:mappedSource.ensureMapped]`, `[fastpath.go:FastPathService.CloseAll]`: Opens/closes read-only OS memory maps (`golang.org/x/exp/mmap`), caches `*mappedSource` entries, and atomically increments `hydrateMisses` on failed line resolutions.

## Verification
- Run: `go test ./...`
