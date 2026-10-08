# Refactoring Plan: Decompose `ImportFeedModal.tsx` (783 lines)

## 1. Context & Motivation
- **File**: `src/components/organisms/ImportFeedModal.tsx` (783 lines)
- **Goal**: Decompose into modular directory `src/components/organisms/import-modal/` per Atomic Design Standards and the 300–400 line UI ceiling.
- **Exemption / Cleanup Completed**: `backend-go/cmd/goldentest/main.go` has been removed as obsolete migration tooling (verified with `go test ./...` and `go vet ./...` passing cleanly).

---

## 2. Proposed Target Architecture (`src/components/organisms/import-modal/`)

```
src/components/organisms/import-modal/
├── types.ts                    (~40 lines)  - ImportFeedModalProps, TabId, Tab definition
├── constants.ts                (~25 lines)  - TABS definition, inputCls, labelCls, isTauri check
├── tabs/
│   ├── LocalTab.tsx            (~120 lines) - Drag-drop file zone, browse dialog, tail switch, init button
│   ├── SshTab.tsx              (~125 lines) - Remote SSH host, port, credentials, path, connect button
│   ├── ManualTab.tsx           (~60 lines)  - Direct newline-separated text buffer paste
│   └── LiveTab.tsx             (~150 lines) - Syslog (UDP) and HTTP API live stream listener setup
├── ImportFeedModal.tsx         (~160 lines) - Coordinator modal shell, Tauri drag-drop listeners, tab switching
└── index.ts                    (~10 lines)  - Barrel export

src/components/organisms/ImportFeedModal.tsx (~5 lines) - Backward-compatibility re-export proxy
```

---

## 3. Detailed Component Boundaries
1. **`types.ts`**:
   - `ImportFeedModalProps`: callbacks `onImportLocal`, `onImportSSH`, `onIngestManual`, `onImportLive`.
   - `TabId`: `"local" | "ssh" | "manual" | "live"`.
   - Sub-component prop interfaces (`LocalTabProps`, `SshTabProps`, `ManualTabProps`, `LiveTabProps`).
2. **`constants.ts`**:
   - `TABS` array with icons and labels.
   - Shared Tailwind classes `inputCls` and `labelCls`.
   - `isTauri` environment detector.
3. **`tabs/LocalTab.tsx`**:
   - Manages drag-and-drop state, selected file card display, clear button, `TailSwitch`, and initialize action.
4. **`tabs/SshTab.tsx`**:
   - Manages host/port/user/password inputs, remote stream tail toggle, connect action.
5. **`tabs/ManualTab.tsx`**:
   - Manages textarea input, placeholder, character buffer ingestion.
6. **`tabs/LiveTab.tsx`**:
   - Manages Syslog and HTTP endpoint toggle cards, displays dynamic endpoint URLs using `settings` and `activeWorkspaceId`.
7. **`ImportFeedModal.tsx`**:
   - Owns `useIngestionStore` bindings, Tauri window drag-and-drop listeners (`tauri://drag-over`, `tauri://drag-drop`), native dialog browsing, backdrop click handling, modal frame header and tab bar (`SourceSelector`).

---

## 4. Verification Plan
1. Execute refactor into `src/components/organisms/import-modal/`.
2. Keep `src/components/organisms/ImportFeedModal.tsx` as a re-export proxy.
3. Run `bun run build` to verify TypeScript, JSX, bundling, and zero regressions.
4. Update `docs/track/CodeDebt_Monolith_Refactor.md`.
