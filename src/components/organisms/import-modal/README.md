# Import Feed Modal

## Overview
Tabbed ingestion modal managing local file drop/browse (with Tauri native drag-and-drop and dialog fallbacks), SSH remote tailing, manual log pasting, and live Syslog/HTTP feed registration.

## Interface
- `[types.ts:ImportFeedModalProps]` - Exported interface with readonly ingestion callbacks `onImportLocal`, `onImportSSH`, `onIngestManual`, and `onImportLive`.
- `[types.ts:TabId]` - Exported union `"local" | "ssh" | "manual" | "live"`.
- `[types.ts:TabOption]` - Exported interface `{ readonly id: TabId; readonly icon: typeof FolderOpen; readonly label: string }`.
- `[types.ts:LocalTabProps]` - Exported readonly props interface for `LocalTab`.
- `[types.ts:SshTabProps]` - Exported readonly props interface for `SshTab`.
- `[types.ts:ManualTabProps]` - Exported readonly props interface for `ManualTab`.
- `[types.ts:LiveTabProps]` - Exported readonly props interface for `LiveTab`.
- `[constants.ts:isTauri]` - Exported boolean detecting `"__TAURI_INTERNALS__"` on `globalThis.window`.
- `[constants.ts:TABS]` - Exported `TabOption[]` list (`local`, `ssh`, `manual`, `live`).
- `[constants.ts:inputCls]` - Exported Tailwind input style string constant.
- `[constants.ts:labelCls]` - Exported Tailwind label style string constant.
- `[index.ts:ImportFeedModal]` - Re-exports `ImportFeedModal` from `./ImportFeedModal`.
- `[index.ts:ImportFeedModalProps]` - Re-exports type `ImportFeedModalProps` from `./types`.
- `[index.ts:LiveTabProps]` - Re-exports type `LiveTabProps` from `./types`.
- `[index.ts:LocalTabProps]` - Re-exports type `LocalTabProps` from `./types`.
- `[index.ts:ManualTabProps]` - Re-exports type `ManualTabProps` from `./types`.
- `[index.ts:SshTabProps]` - Re-exports type `SshTabProps` from `./types`.
- `[index.ts:TabId]` - Re-exports type `TabId` from `./types`.
- `[index.ts:TabOption]` - Re-exports type `TabOption` from `./types`.
- `[index.ts:isTauri]` - Re-exports `isTauri` from `./constants`.
- `[index.ts:TABS]` - Re-exports `TABS` from `./constants`.
- `[ImportFeedModal.tsx:ImportFeedModal]` - Exported React component orchestrating modal visibility, Tauri/DOM file selection, and active tab rendering.
- Child contract: [tabs](./tabs/README.md).

## Invariants
- `[types.ts:TabId]` Restricts active tabs to `"local" | "ssh" | "manual" | "live"`.
- `[constants.ts:isTauri]` Evaluated once at module load from `globalThis.window !== undefined && "__TAURI_INTERNALS__" in globalThis.window`.
- `[ImportFeedModal.tsx:ImportFeedModal]` Returns `null` and triggers `resetImportForm()` whenever `isImportOpen` is false; attaches Tauri drag listeners only when `isTauri && open` and uses `paths[0]` on drop; disables backdrop and close controls while `isImportProcessing` is true; renders only the single tab matching `activeTab`.
- `[ImportFeedModal.tsx:handleDrop]` Extracts only `e.dataTransfer.files?.[0]` with path fallback `(file as any).path || file.name`.
- `[ImportFeedModal.tsx:handleBrowse]` Enforces single-file selection filtered to `log`, `syslog`, `txt`, `json`, `csv` (plus `*` in Tauri).

## Side Effects
- `[ImportFeedModal.tsx:ImportFeedModal]` Subscribes to `useIngestionStore`, `useWorkspaceStore`, and `useSettingsStore`; invokes `resetImportForm()` when closed; dynamically imports `@tauri-apps/api/event` to attach/unlisten `tauri://drag-over`, `tauri://drag-leave`, and `tauri://drag-drop` listeners; dynamically imports `@tauri-apps/plugin-dialog` or clicks an ephemeral `<input type="file">` in `handleBrowse`; logs `console.error` / `console.warn` on Tauri errors; mutates `isDragOver` and store fields `setLocalPath`, `setImportOpen`, and `setImportActiveTab`.

## Verification
- Run: `bun test`
