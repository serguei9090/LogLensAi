# Refactoring Plan: Ingestion Store Deconstruction (`src/store/ingestionStore.ts`)

> **Target**: `src/store/ingestionStore.ts` (660 lines)  
> **Goal**: Modularize into clean, single-responsibility slices under `src/store/ingestion/` adhering to the <300 line standard while maintaining 100% backward compatibility for all callers.

---

## 1. Problem & Architecture Overview

`src/store/ingestionStore.ts` currently mixes 4 distinct concerns:
1. **Types & Trace Utilities**: `IngestionJob`, `traceIngestion`, and helper interfaces.
2. **Import Modal Form State & Actions**: `isImportOpen`, `isImportProcessing`, `importActiveTab`, SSH config, live ingestion switches, and form setters/reset.
3. **Ingestion Jobs & Polling Engine**: `fetchJobs`, adaptive polling loops (`startPolling`, `POLL_ACTIVE_MS`, `POLL_LIVE_MS`), cross-workspace poll sessions map, and completion event orchestration.
4. **Source Lifecycle & Job Tracking State**: Ingesting/transitioning/retrieving source sets, handled job deduplication (`handledJobIds`, `markJobHandled`), and job cleanup actions.

---

## 2. Target File Structure

We will create `src/store/ingestion/`:
```text
src/store/ingestion/
├── types.ts          (~45 lines)   - IngestionJob, WorkspacePollSession, State interfaces
├── trace.ts          (~20 lines)   - traceIngestion utility function
├── importSlice.ts    (~90 lines)   - Import modal form state & action handlers
├── trackingSlice.ts  (~140 lines)  - Handled jobs, transitioning sources, ingesting/retrieving sets
├── pollingSlice.ts   (~220 lines)  - fetchJobs, startPolling, adaptive polling scheduler & session map
└── index.ts          (~60 lines)   - Zustand store assembly combining all slices & event listener
```

And update `src/store/ingestionStore.ts`:
- Re-exports everything from `./ingestion` so all existing imports throughout the app (`useIngestionStore`, `IngestionJob`, `traceIngestion`) resolve seamlessly with zero breakage.

---

## 3. Verification Plan

1. Verify TypeScript build: `bun run build`.
2. Verify all existing tests pass: `bun test` (if applicable) and Go sidecar tests `go test ./...`.
