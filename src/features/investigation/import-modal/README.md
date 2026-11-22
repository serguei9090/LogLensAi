# Import Modal

## Overview
Multi-tab log feed import modal container supporting local file picking/drag-and-drop (Tauri and browser), SSH remote tailing, manual log buffer paste, and live Syslog/HTTP stream creation.

## Interface
- `[ImportFeedModal.tsx:ImportFeedModal]` — Modal container coordinating `useIngestionStore`, `useWorkspaceStore`, `useSettingsStore`, Tauri/DOM file picking, and tab selection.
- `[index.ts]` — Re-exports `ImportFeedModal`, `type ImportFeedModalProps`, `type TabId`, `type TabOption`, `type LocalTabProps`, `type SshTabProps`, `type ManualTabProps`, `type LiveTabProps`, `isTauri`, and `TABS`.
- `[types.ts:ImportFeedModalProps]` — Readonly props interface (`onImportLocal`, `onImportSSH`, `onIngestManual`, `onImportLive`).
- `[types.ts:TabId]` — Union `"local" | "ssh" | "manual" | "live"`.
- `[types.ts:TabOption]` — Tab metadata interface `{ id: TabId; icon: typeof FolderOpen; label: string }`.
- `[types.ts:LocalTabProps]`, `[types.ts:SshTabProps]`, `[types.ts:ManualTabProps]`, `[types.ts:LiveTabProps]` — Readonly tab component prop contracts.
- `[constants.ts:isTauri]` — Runtime check `globalThis.window !== undefined && "__TAURI_INTERNALS__" in globalThis.window`.
- `[constants.ts:TABS]` — Array of the four `TabOption` definitions (`local`, `ssh`, `manual`, `live`).
- `[constants.ts:inputCls]`, `[constants.ts:labelCls]` — Internal shared Tailwind CSS class strings (not re-exported by `index.ts`).
- Subdirectories:
  - [tabs](./tabs/README.md) — Controlled `LiveTab`, `LocalTab`, `ManualTab`, and `SshTab` panels.

## Invariants
- `[types.ts:TabId]` Restricts tab identifiers to `"local" | "ssh" | "manual" | "live"`, matching `TABS`; all prop interfaces in `types.ts` declare `readonly` properties.
- `[ImportFeedModal.tsx:ImportFeedModal]` Returns `null` when `isImportOpen` is `false` and invokes `resetImportForm()` in `useEffect` whenever `open` is falsy; disables backdrop/close actions while `isImportProcessing` is `true`.
- `[ImportFeedModal.tsx:ImportFeedModal]` Subscribes to Tauri drag-drop events only when `isTauri && open`; sets `localPath` to `payload.paths[0]` or `e.dataTransfer.files?.[0]`; enforces single-file selection (`multiple: false`, `directory: false` in Tauri) for `.log`, `.syslog`, `.txt`, `.json`, `.csv`; mutually exclusively renders `LocalTab`, `SshTab`, `ManualTab`, or `LiveTab` by `importActiveTab`.

## Side Effects
- `[ImportFeedModal.tsx:ImportFeedModal]` Mutates `useIngestionStore` (`resetImportForm`, setters) and reads `useWorkspaceStore`/`useSettingsStore`; dynamically imports `@tauri-apps/api/event` (`tauri://drag-over`, `tauri://drag-leave`, `tauri://drag-drop`) and `@tauri-apps/plugin-dialog` in Tauri mode; creates/clicks an ephemeral `<input type="file">` in browser mode; logs errors via `console.error`/`console.warn`; calls `preventDefault()` on drag events and forwards submit callbacks.

## Verification
- Run: `bun test`
