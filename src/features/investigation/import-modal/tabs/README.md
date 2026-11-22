# Import Modal Tabs

## Overview
Controlled React tab panels (`LiveTab`, `LocalTab`, `ManualTab`, `SshTab`) composing the input forms for the Investigation feed import modal while delegating all RPC and ingestion actions to parent callbacks.

## Interface
- `[LiveTab.tsx:LiveTab]` — Live Syslog UDP / HTTP stream collection configuration form.
- `[LocalTab.tsx:LocalTab]` — Local log file picker, drag-and-drop zone, and live tail toggle panel.
- `[ManualTab.tsx:ManualTab]` — Raw log snippet paste textarea for direct buffer ingestion.
- `[SshTab.tsx:SshTab]` — Remote SSH tailing connection form (host, port, user, password/key, log path, tail toggle).

## Invariants
- `[LiveTab.tsx:LiveTab]` Reads `isImportProcessing` from `useIngestionStore` to disable inputs and submission; disables submit unless `liveName.trim()` is non-empty and `liveSyslog || liveHttp` is true; renders ingestion endpoint preview only when `liveHttp || liveSyslog` is truthy using `settings.ingestion_http_port` and `settings.ingestion_syslog_port`.
- `[LocalTab.tsx:LocalTab]` Reads `isImportProcessing` from `useIngestionStore` to lock controls; switches between selected file summary (filename via `localPath.split(/[/\\]/).pop()`) and drag/browse dropzone; disables submit unless `localPath.trim()` is non-empty.
- `[ManualTab.tsx:ManualTab]` Reads `isImportProcessing` from `useIngestionStore` to disable textarea and submit; disables submit unless `manualLogs.trim()` is non-empty.
- `[SshTab.tsx:SshTab]` Reads `isImportProcessing` from `useIngestionStore` to disable inputs, `TailSwitch`, and submit; requires truthy `sshHost`, `sshUser`, and `sshPath` (without `.trim()` and without gating on `sshPort` or `sshPass`) and coerces `sshPort` via `Number(sshPort)` before calling `onImportSSH`.

## Side Effects
- None

## Verification
- Run: `bun test`
