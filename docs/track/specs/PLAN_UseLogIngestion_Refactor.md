# Refactoring Plan: `src/lib/hooks/useLogIngestion.ts`

> **Target**: `src/lib/hooks/useLogIngestion.ts` (620 lines)  
> **Goal**: Cleanly modularize the hook into focused feature handlers under `src/lib/hooks/ingestion/` (local, remote/ssh, manual, live streams, duplicate), keeping all files well below the 300-line standard.
> **Note**: Per user instructions, no backward compatibility shims needed—clean, direct modern organization.

---

## 1. Problem & Architecture Overview

`useLogIngestion.ts` manages:
1. Local file import & tailing (`handleImportLocal`, `handleStopTail`)
2. SSH remote stream setup (`handleImportSSH`)
3. Manual paste ingestion (`handleIngestManual`)
4. Live listener streams for syslog & HTTP (`handleImportLive`)
5. Source duplication with state snapshot copying (`duplicateSource`)
6. Active tail tracking state (`tailingSourceIds`)

All combined into a single 620-line file.

---

## 2. Target File Structure (`src/lib/hooks/ingestion/`)

```text
src/lib/hooks/ingestion/
├── types.ts          (~25 lines)  - Ingestion handler function signatures & types
├── localIngest.ts    (~130 lines) - Local file ingest & tailing lifecycle
├── remoteIngest.ts   (~95 lines)  - SSH tailing & remote connection
├── manualIngest.ts   (~60 lines)  - Text buffer / paste ingestion
├── liveIngest.ts     (~75 lines)  - Syslog / HTTP listener creation
├── duplicateIngest.ts(~85 lines)  - Source cloning & state replication
└── index.ts          (~90 lines)  - useLogIngestion hook orchestrator
```

And update callers:
- `src/components/pages/investigation/InvestigationPage.tsx`
- `src/components/molecules/HierarchyTree.tsx`
to import cleanly from `@/lib/hooks/ingestion`.

---

## 3. Verification Plan

1. Verify TypeScript compilation: `bun run build`.
2. Confirm zero regressions across all imports.
