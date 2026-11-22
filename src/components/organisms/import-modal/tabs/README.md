# Import Modal Tabs

## Overview
Tab form panels inside the feed import modal covering live network streams (Syslog/HTTP), local file selection with drag-and-drop and tailing, manual log pasting, and remote SSH log tailing.

## Interface
- `[LiveTab.tsx:LiveTab]` - Exported React component rendering the live Syslog/HTTP ingestion source form and endpoint preview.
- `[LocalTab.tsx:LocalTab]` - Exported React component rendering the local file dropzone/selected-file card, live-tail toggle, and submit control.
- `[ManualTab.tsx:ManualTab]` - Exported React component rendering the multi-line raw log paste textarea and submit control.
- `[SshTab.tsx:SshTab]` - Exported React component rendering the remote SSH host, port, credentials, remote path, live-tail toggle, and submit control.

## Invariants
- `[LiveTab.tsx:LiveTab]` Reads `useIngestionStore((state) => state.isImportProcessing)` and disables `#live-name`, protocol toggle buttons, and submit while processing; renders the endpoint preview only when `liveHttp || liveSyslog` (interpolating `settings.ingestion_http_port`, `activeWorkspaceId`, `liveName || "my-collection"`, and `settings.ingestion_syslog_port`); disables submit when `!liveName.trim() || (!liveSyslog && !liveHttp) || isProcessing` and passes trimmed `liveName` to `onImportLive`.
- `[LocalTab.tsx:LocalTab]` Disables clear button, dropzone button (`pointer-events-none`), `TailSwitch`, and submit while `isImportProcessing` is true; switches between selected file display (`localPath.split(/[/\\]/).pop() || localPath`) and browse dropzone based on `localPath` truthiness; disables submit when `!localPath.trim() || isProcessing` and passes `localPath.trim()` to `onImportLocal`.
- `[ManualTab.tsx:ManualTab]` Disables `#manual-logs` textarea and submit while `isImportProcessing` is true; disables submit when `!manualLogs.trim() || isProcessing` and passes `manualLogs.trim()` to `onIngestManual`.
- `[SshTab.tsx:SshTab]` Disables all SSH inputs, `TailSwitch`, and submit while `isImportProcessing` is true; disables submit when `!sshHost || !sshUser || !sshPath || isProcessing` (without `.trim()`, leaving `sshPort` and `sshPass` optional) and coerces `sshPort` with `Number(sshPort)` before invoking `onImportSSH`.

## Side Effects
- `[LiveTab.tsx:LiveTab]` Subscribes to `useIngestionStore` (`isImportProcessing`) and delegates state updates and ingestion via parent callbacks (`setLiveName`, `setLiveSyslog`, `setLiveHttp`, `onImportLive`).
- `[LocalTab.tsx:LocalTab]` Subscribes to `useIngestionStore` (`isImportProcessing`) and delegates file clearing, drag-and-drop, browsing, tail toggling, and ingestion via parent callbacks (`setLocalPath`, `handleDragOver`, `handleDragLeave`, `handleDrop`, `handleBrowse`, `setLocalTail`, `onImportLocal`).
- `[ManualTab.tsx:ManualTab]` Subscribes to `useIngestionStore` (`isImportProcessing`) and delegates text updates and ingestion via parent callbacks (`setManualLogs`, `onIngestManual`).
- `[SshTab.tsx:SshTab]` Subscribes to `useIngestionStore` (`isImportProcessing`) and delegates field updates, tail toggling, and SSH connection via parent callbacks (`setSshHost`, `setSshPort`, `setSshUser`, `setSshPass`, `setSshPath`, `setSshTail`, `onImportSSH`).

## Verification
- Run: `bun test`
