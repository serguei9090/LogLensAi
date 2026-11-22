# Ingestion Hooks (`src/lib/hooks/ingestion`)

## Overview
React hook and async workflow helpers for importing and duplicating log sources (local files, live syslog/HTTP streams, manual text buffers, and SSH remote tails). Coordinates workspace source registration, investigation view state preparation, ingestion job polling, and sidecar JSON-RPC dispatch.

## Interface
- `LogIngestionHookResult` (`[types.ts:LogIngestionHookResult]`): Return contract interface for `useLogIngestion`, exposing `tailingSourceIds`, `setTailingSourceIds`, `handleImportLocal`, `duplicateSource`, `handleStopTail`, `handleImportSSH`, `handleIngestManual`, and `handleImportLive`.
- `useLogIngestion(workspaceId)` (`[index.ts:useLogIngestion]`): React hook managing local `tailingSourceIds` (`Set<string>`) state and returning workspace-scoped ingestion callbacks; re-exports all modules in this package (`[index.ts]`).
- `duplicateLogSource(workspaceId, source)` (`[duplicateIngest.ts:duplicateLogSource]`): Creates a uniquely named duplicate `LogSource` (`(Copy)` / `(Copy N)`), clones investigation snapshot state with cleared selections, activates it, and triggers `ingest_local_file` when duplicating a `"local"` source with a `path`.
- `importLiveStream(workspaceId, name, types, folderId?)` (`[liveIngest.ts:importLiveStream]`): Creates syslog/HTTP stream listeners via `create_log_stream` using configured ports from `useSettingsStore`, registers a `"live"` source, increments live source count, and starts polling.
- `importLocalFile(workspaceId, path, tail, folderId, setTailingSourceIds)` (`[localIngest.ts:importLocalFile]`): Normalizes file paths, creates a uniquely named `"local"` source, calls `ingest_local_file`, updates ingestion job state on immediate completion or starts polling, and optionally invokes `start_tail`.
- `stopTail(workspaceId, sourceId, filepath, setTailingSourceIds)` (`[localIngest.ts:stopTail]`): Stops active file tailing via `stop_tail`, decrements live source count, and updates `tailingSourceIds`.
- `ingestManualLogs(workspaceId, rawText, folderId?)` (`[manualIngest.ts:ingestManualLogs]`): Creates a `"manual"` source, parses lines via `parseManualLogs`, sends entries via `ingest_logs`, and starts polling.
- `importSshStream(workspaceId, host, port, user, pass, path, tail, folderId, setTailingSourceIds)` (`[remoteIngest.ts:importSshStream]`): Registers an `"ssh"` source (`user@host:path`) and calls `start_ssh_tail` when live tailing is enabled.

## Invariants
- Null-workspace guard: `useLogIngestion` callbacks return early without executing when `workspaceId` is `null` (`[index.ts:useLogIngestion]`), with `duplicateSource` additionally displaying an error toast (`[index.ts:useLogIngestion]`).
- Unique source naming: `importLocalFile` deduplicates filenames with ` (N)` suffixes (`[localIngest.ts:importLocalFile]`), and `duplicateLogSource` deduplicates names with ` (Copy)` / ` (Copy N)` suffixes (`[duplicateIngest.ts:duplicateLogSource]`).
- Path normalization: `importLocalFile` converts all backslashes (`\`) to forward slashes (`/`) before creating the source and calling sidecar RPCs (`[localIngest.ts:importLocalFile]`).
- Selection reset on duplication: `duplicateLogSource` copies the existing or active investigation snapshot into `sourceStates[newSource.id]` with `selectedLogIds` forced to `[]` (`[duplicateIngest.ts:duplicateLogSource]`).
- Empty manual payload guard: `ingestManualLogs` exits without dispatching `ingest_logs` if `parseManualLogs(rawText)` returns zero entries (`[manualIngest.ts:ingestManualLogs]`).
- SSH live-stream guard: `importSshStream` exits without calling `start_ssh_tail` when `tail` is `false` (`[remoteIngest.ts:importSshStream]`).
- Tailing state consistency: `stopTail` sets `useInvestigationStore` `isTailing` to `false` once `tailingSourceIds` becomes empty (`[localIngest.ts:stopTail]`).
- Failure cleanup: `importLocalFile`, `ingestManualLogs`, and `importSshStream` clear transitioning and active ingestion markers for `newSourceId` and reset `importProcessing` on error (`[localIngest.ts:importLocalFile]`, `[manualIngest.ts:ingestManualLogs]`, `[remoteIngest.ts:importSshStream]`).

## Side Effects
- Sidecar JSON-RPC invocations via `callSidecar`: `ingest_local_file` (`[duplicateIngest.ts:duplicateLogSource]`, `[localIngest.ts:importLocalFile]`), `start_tail` and `stop_tail` (`[localIngest.ts:importLocalFile]`, `[localIngest.ts:stopTail]`), `create_log_stream` (`[liveIngest.ts:importLiveStream]`), `ingest_logs` (`[manualIngest.ts:ingestManualLogs]`), and `start_ssh_tail` (`[remoteIngest.ts:importSshStream]`).
- Zustand store state mutations across `useWorkspaceStore`, `useIngestionStore`, and `useInvestigationStore`, plus reads of `useSettingsStore` (`[duplicateIngest.ts:duplicateLogSource]`, `[liveIngest.ts:importLiveStream]`, `[localIngest.ts:importLocalFile]`, `[localIngest.ts:stopTail]`, `[manualIngest.ts:ingestManualLogs]`, `[remoteIngest.ts:importSshStream]`).
- Global DOM event dispatch: emits `CustomEvent("loglens:refresh-logs")` on `globalThis` (`[duplicateIngest.ts:duplicateLogSource]`, `[localIngest.ts:importLocalFile]`).
- Timers & UI notifications: schedules 300ms `setTimeout` modal close callbacks (`[liveIngest.ts:importLiveStream]`, `[localIngest.ts:importLocalFile]`, `[manualIngest.ts:ingestManualLogs]`, `[remoteIngest.ts:importSshStream]`) and displays `sonner` toast messages (`[index.ts:useLogIngestion]`, `[duplicateIngest.ts:duplicateLogSource]`, `[liveIngest.ts:importLiveStream]`, `[localIngest.ts:importLocalFile]`, `[localIngest.ts:stopTail]`, `[manualIngest.ts:ingestManualLogs]`, `[remoteIngest.ts:importSshStream]`).

## Verification
- Run: `bun test`
