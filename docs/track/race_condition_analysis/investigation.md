# Race Condition & State Management Investigation

**Date:** 2026-07-04  
**File:** `docs/track/race_condition_analysis/investigation.md`

---

## Executive Summary

The user's symptoms:
1. "Complete" message sent instantly even if processing isn't complete
2. Log lines showing before processing is finished  
3. State loss in Zustand - jobs losing state across page navigation

This document identifies **4 distinct root causes** and provides a prioritized remediation plan.

---

## Architecture Overview

```
Frontend (React + Zustand)
├── useLogIngestion.ts      → Triggers ingestion, starts polling
├── InvestigationPage.tsx   → Job completion handler, state orchestration
├── VirtualLogTable.tsx     → UI overlays (Preparing → Indexing)
├── ingestionStore.ts       → Ingestion state (NOT persisted)
└── workspaceStore.ts       → Sources, hierarchy (PERSISTED via localStorage)

Backend (Python Sidecar)
├── api.py                  → JSON-RPC dispatch
├── _ingestion_queue_worker → Background serial worker
└── db.py                   → DuckDB persistence
```

---

## Root Cause Analysis

### RC-1: `is_uploaded` Shortcut Returns "completed" Without a Job

**File:** `sidecar/src/api.py:1650-1663`

```python
def method_ingest_local_file(...):
    cursor.execute("SELECT is_uploaded FROM log_sources WHERE id = ?", (source_id,))
    row = cursor.fetchone()
    if row and row[0]:  # Source already uploaded
        return {"status": "completed", "job_id": 0, "total_lines": 0, ...}  # ← EARLY RETURN
```

**Problem:** When a source is re-uploaded (or when source exists from prior session), the sidecar returns `status: "completed"` instantly without creating a DB job.

**Frontend consequence (`useLogIngestion.ts:82-94`):**
```typescript
useIngestionStore.getState().addOrUpdateJob(newJob);
// newJob.status = "completed" ← from sidecar's early return
```

The completion handler in `InvestigationPage.tsx` runs immediately. But the data might not be loaded into the table yet because:
1. The completion handler calls `fetchHierarchy()` → sets `is_uploaded = true`
2. Then calls `fetchLogs({ forceFull: true })`  
3. Meanwhile `useEffect([fetchLogs])` at line 289 ALSO fires

**Result:** Race between two concurrent `fetchLogs` calls. One may succeed and show logs before the other completes.

---

### RC-2: `fetchLogs` Called Twice on Job Completion

**File:** `src/components/pages/InvestigationPage.tsx:312-371`

```typescript
// Effect 1: Job completion handler (fires when jobs state changes)
useEffect(() => {
    for (const sourceJob of jobs) {
        if (sourceJob.status !== "completed") continue;
        // ...
        (async () => {
            await fetchHierarchy(workspaceId);
            await fetchLogs({ forceFull: true });  // ← First call
        })();
    }
}, [jobs, activeSourceId, fetchLogs]);

// Effect 2: Triggers on EVERY render where fetchLogs reference changes
useEffect(() => {
    fetchLogs();  // ← Second call (unconditional!)
}, [fetchLogs]);
```

**Problem:** The second `useEffect([fetchLogs])` at line 289 fires whenever `fetchLogs` changes. When a job completes, `fetchLogs` reference stays the same (it's a `useCallback`), but `activeSourceId` might change. However, if `activeSourceId` doesn't change, the dependency issue is subtle.

The real problem is `fetchLogs()` at line 348 in the completion handler **immediately** calls `fetchLogs` while the modal is still showing. If the DB query returns instantly (small file or cached data), logs appear before the overlay transitions complete.

**Additionally:** `useEffect([fetchLogs])` at line 289 fires on every render where `fetchLogs` reference changes. When the job completes and `activeJobForSource` becomes `null`, `isSourceLoading` becomes `false`, which might trigger a re-render that changes the `fetchLogs` closure... but `fetchLogs` is stable via `useCallback` so this isn't the direct cause.

The real issue is in `useLogFetching.ts:298-302`:
```typescript
// NOTE: Do NOT call stopIngestion() here.
```

This comment explains that calling `stopIngestion()` here would race. But the inverse is true: NOT calling it means the source stays in `ingestingSourceIds`, and `isSourceLoading` stays `true`. However...

**The fetchLogs race:**
```typescript
// InvestigationPage.tsx:348
await fetchLogs({ forceFull: true });

// InvestigationPage.tsx:289  
useEffect(() => { fetchLogs(); }, [fetchLogs]);
```

If `fetchLogs` is called at line 348 while `useEffect([fetchLogs])` is already scheduled or fires simultaneously, you get two concurrent fetches. The second one might complete first (if the first is waiting on clustering), showing logs before the state machine is ready.

---

### RC-3: Zustand `ingestionStore` Is NOT Persisted

**File:** `src/store/ingestionStore.ts:143`

```typescript
export const useIngestionStore = create<IngestionState>((set, get) => ({
    jobs: [],           // ← NOT persisted
    ingestingSourceIds: [],  // ← NOT persisted
    transitioningSourceIds: new Set(),  // ← NOT persisted
    // ...
}));
```

Compare to `workspaceStore.ts:206-436`:
```typescript
export const useWorkspaceStore = create<WorkspaceStore>()(
    persist(  // ← IS persisted
        (set) => ({ ... }),
        { name: "loglensai-workspaces-v4" }
    )
);
```

**Problem:** If the page reloads, the browser refreshes, or React hydration occurs, the ingestion state is wiped. The jobs array becomes empty, `ingestingSourceIds` is cleared.

**Consequence:** The sidecar's background worker is still running (it has its own queue), but the frontend thinks no job is active. The overlay disappears. Logs appear via `fetchLogs` triggered by the `useEffect([fetchLogs])` without any loading state.

**The sidecar has startup recovery** (`api.py:395-439`) that re-queues interrupted jobs. But the frontend has no corresponding recovery mechanism. On page reload:
1. `InvestigigationPage` mounts
2. `useEffect([fetchLogs])` at line 289 calls `fetchLogs()` 
3. Logs are fetched immediately — no loading overlay
4. `useEffect([activeWorkspaceId])` at line 251 tries to start polling, but `ingestionStore.jobs` is empty
5. No job found → no polling started → no state tracking

**This is the primary cause of "logs showing before processing finished" after a page reload.**

---

### RC-4: `showPreparing` vs `showOverlay` Race in VirtualLogTable

**File:** `src/components/organisms/VirtualLogTable.tsx:435-440`

```typescript
const showOverlay = (isIngesting || isQueued || (isTransitioning && !isTailing)) && logs.length === 0;
const showPreparing = !activeJob && !!(
    activeWorkspace?.activeSourceId &&
    transitioningSourceIds.has(activeWorkspace.activeSourceId)
) && logs.length === 0;
```

**Problem:** The expected sequence is:
1. Upload clicked → `addTransitioningSource(newSource.id)` → `showPreparing = true` → "Preparing Ingestion..." overlay
2. Job added via `addOrUpdateJob` → `activeJob = job` → `showPreparing = false`, `showOverlay = true` → "Indexing Dataset..." overlay  
3. Job completes → overlay removed

**Current sequence:**
1. Upload clicked → `ingestingSourceIds` set immediately → `showOverlay = true` → **"Indexing Dataset..."** (SKIPS "Preparing")
2. Job added → `activeJob = job` → progress bar updates

**The user expects "Preparing" first, then "Indexing". But the code shows "Indexing" immediately because `isCurrentlyIngesting` is true from the start.**

---

## State Clearing Points (All locations)

| Location | Action | State Cleared | 
|----------|--------|--------------|
| `ingestionStore.ts:478` `clearState()` | Filters out completed/failed jobs | `jobs` trimmed to active only |
| `ingestionStore.ts:457` `clearCompletedState()` | Removes completed job for source | `jobs` for specific source |
| `ingestionStore.ts:505` `removeJobsForSource()` | Removes all jobs for source | `jobs` for specific source |
| `workspaceStore.ts:296` `removeSource()` | Removes source, calls `removeJobsForSource` | All jobs for source |
| `InvestigationPage.tsx:353` | In completion handler | Completed job removed |
| **Page reload** | Browser refresh | **ALL ingestion state wiped** |

---

## The Zustand Global State Question

The user asks: "is Zustand properly managing global state? if a separate sidecar can be the solution well perfect"

**Answer: Zustand IS global within a browser session.** The issue is:

1. **Within a session:** Zustand state persists across component mounts/unmounts. `handledJobIds` in `ingestionStore` is specifically designed to survive `InvestigationPage` unmount/remount (see comment at `ingestionStore.ts:43-48`).

2. **Across sessions (page reload):** Zustand state is wiped unless `persist` middleware is used. `ingestionStore` does NOT use `persist`.

3. **The sidecar as persistence layer:** The sidecar already has the truth:
   - `is_uploaded` flag on `log_sources` table
   - `ingestion_jobs` table with status tracking
   - Startup recovery mechanism

**The fix is to make the frontend query the sidecar for truth on mount, rather than relying on in-memory Zustand state.**

---

## Proposed Solutions (Priority Order)

### P1: Fix the Double fetchLogs Race (RC-2)

Remove the redundant `fetchLogs` call from the completion handler. Rely exclusively on `useEffect([fetchLogs])`.

**File:** `src/components/pages/InvestigationPage.tsx`

```typescript
// REMOVE from completion handler:
await fetchLogs({ forceFull: true });

// The useEffect at line 289 will fire when:
// 1. fetchLogs reference changes (not during completion)
// 2. activeSourceId changes (not during completion)
// This means completion doesn't need to manually call fetchLogs
```

### P2: Query Sidecar for Ingestion State on Mount (RC-3)

On workspace load, fetch active jobs from sidecar and restore ingestion state.

**File:** `src/components/pages/InvestigationPage.tsx`

```typescript
useEffect(() => {
    if (!activeWorkspaceId) return;
    
    // Restore ingestion state from sidecar on mount
    const restoreIngestionState = async () => {
        const jobs = await callSidecar<IngestionJob[]>({
            method: "get_ingestion_jobs",
            params: { workspace_id: activeWorkspaceId }
        });
        
        for (const job of jobs) {
            useIngestionStore.getState().addOrUpdateJob(job);
            useIngestionStore.getState().startIngestion(job.source_id);
        }
        
        // Resume polling for active jobs
        const hasActive = jobs.some(
            j => j.status === "queued" || j.status === "pending" || j.status === "processing"
        );
        if (hasActive) {
            useIngestionStore.getState().startPolling(activeWorkspaceId);
        }
    };
    
    restoreIngestionState();
}, [activeWorkspaceId]);
```

### P3: Fix showPreparing Sequence (RC-4)

Make `showPreparing` take precedence over `showOverlay` and fix the logic:

**File:** `src/components/organisms/VirtualLogTable.tsx`

```typescript
// Current (problematic):
const showOverlay = (isIngesting || isQueued || ...) && logs.length === 0;
const showPreparing = !activeJob && transitioningSourceIds.has(...);

// Fix: Show preparing if transitioning, regardless of ingestingSourceIds
const showPreparing = transitioningSourceIds.has(activeWorkspace?.activeSourceId ?? "") && logs.length === 0;

// Only show Indexing if we have an actual job with progress
const showIndexing = (isCurrentlyIngesting && !!activeJob) && logs.length === 0;
```

**Frontend changes to `useLogIngestion.ts`:**

The "Preparing" → "Indexing" transition should be:
1. Upload clicked → `addTransitioningSource` + `startIngestion` → **"Preparing Ingestion..."** (showPreparing = true)
2. Job added via `addOrUpdateJob` → `activeJob` set → **"Indexing Dataset..."** (showIndexing = true, showPreparing = false)

### P4: Fix is_uploaded Shortcut (RC-1)

When sidecar returns `status: "completed"` from `is_uploaded` check, still create a local tracking job so the state machine works correctly.

**File:** `useLogIngestion.ts:82-94`

```typescript
// When status is "completed" from is_uploaded check:
if (result.status === "completed" && result.job_id === 0) {
    // Still track locally even though no DB job exists
    const trackingJob: IngestionJob = {
        id: Date.now(),  // Local-only ID
        workspace_id: workspaceId,
        source_id: newSource.id,
        status: "completed",
        total_lines: 0,
        processed_lines: 0,
        queue_position: 0,
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
    };
    useIngestionStore.getState().addOrUpdateJob(trackingJob);
    
    // Immediately mark as handled since data already exists
    useIngestionStore.getState().markJobHandled(trackingJob.id);
    
    // Skip polling - data is already there
    // Just refresh hierarchy and fetch logs
    await useWorkspaceStore.getState().fetchHierarchy(workspaceId);
    startPolling(workspaceId);
    setTimeout(() => { setImportOpen(false); setImportProcessing(false); }, 300);
    return;
}
```

### P5: Persist Critical Ingestion State (RC-3, Long-term)

If the app needs to survive browser refreshes while maintaining ingestion state:

**File:** `src/store/ingestionStore.ts`

```typescript
export const useIngestionStore = create<IngestionState>()(
    (set, get) => ({ /* existing */ }),
    {
        name: "loglensai-ingestion-v1",
        partialize: (state) => ({
            // Only persist job tracking for recovery
            jobs: state.jobs.filter(
                j => j.status === "queued" || j.status === "pending" || j.status === "processing"
            ),
            transitioningSourceIds: [...state.transitioningSourceIds],
            ingestingSourceIds: state.ingestingSourceIds,
            handledJobIds: [...state.handledJobIds],
        }),
    }
);
```

**However:** This adds complexity. A simpler approach is to always recover from the sidecar (P2) and not persist ingestion state at all.

---

## State Machine Reference

```
┌─────────────────────────────────────────────────────────────────────┐
│                    INGESTION STATE MACHINE                          │
├─────────────────────────────────────────────────────────────────────┤
│                                                                     │
│  [Upload Clicked]                                                   │
│       │                                                             │
│       ▼                                                             │
│  ┌─ PREPARING ──────────────┐                                      │
│  │ addTransitioningSource() │ ← showPreparing = true               │
│  │ startIngestion()         │ ← ingestingSourceIds.add(sourceId)    │
│  │ setLogs([], 0)           │ ← Clear table                        │
│  └──────────────────────────┘                                      │
│       │                                                             │
│       │ addOrUpdateJob(job)                                         │
│       ▼                                                             │
│  ┌─ QUEUED ───────────────────────────────────┐                    │
│  │ activeJob.status = "queued"                │ ← showOverlay=true  │
│  │ queue_position > 1 → "Queued for #N"      │   isQueued=true     │
│  └────────────────────────────────────────────┘                    │
│       │                                                             │
│       │ poll detects job → status="processing"                     │
│       ▼                                                             │
│  ┌─ PROCESSING (INDEXING) ───────────────────────────────────────┐ │
│  │ activeJob.status = "processing"                        │        │
│  │ processed_lines updates via poll                  │        │
│  │ Progress bar shows processed/total            │        │
│  └───────────────────────────────────────────────────────────┘ │
│       │                                                             │
│       │ poll detects status="completed"                            │
│       ▼                                                             │
│  ┌─ COMPLETED ───────────────────────────────────────────────────┐  │
│  │ markJobHandled()                                    │         │
│  │ fetchHierarchy() → sets is_uploaded=true           │         │
│  │ fetchLogs() → loads data                          │         │
│  │ stopIngestion() → ingestingSourceIds.remove()     │         │
│  │ clearCompletedState() → removes from jobs[]        │         │
│  └─────────────────────────────────────────────────────────────┘  │
│                                                                     │
└─────────────────────────────────────────────────────────────────────┘
```

---

## Immediate Fix Checklist

1. [ ] **P2:** Add `restoreIngestionState()` on mount in InvestigationPage
2. [ ] **P1:** Remove `fetchLogs()` from completion handler (use useEffect only)
3. [ ] **P3:** Fix `showPreparing` / `showIndexing` logic in VirtualLogTable  
4. [ ] **P4:** Handle `status: "completed"` from `is_uploaded` check in useLogIngestion
5. [ ] **Verify:** Test full flow: upload → preparing → indexing → complete
6. [ ] **Verify:** Test page reload during active ingestion
7. [ ] **Verify:** Test re-upload of already-uploaded source

---

## Architecture Decision: Zustand vs Sidecar State

| Aspect | Zustand (Current) | Sidecar as Source of Truth |
|--------|-------------------|---------------------------|
| **Session scope** | Global within tab | Survives page reload |
| **Persistence** | Optional (needs persist middleware) | Automatic (DuckDB) |
| **Cross-tab sync** | No | No (but sidecar survives) |
| **Complexity** | Simple | Slightly more RPC calls |
| **Recovery** | Manual | Built-in (startup recovery exists) |

**Recommendation:** Keep ingestion state in Zustand for performance (avoid RPC on every state change), but **recover from sidecar on mount** (P2). The sidecar already has startup recovery — extend the pattern to the frontend.

A separate sidecar for state is **NOT needed** because:
1. The existing sidecar already has all state in DuckDB
2. The existing sidecar has startup recovery
3. Zustand is fine for in-session state management
4. Adding a separate state sidecar adds complexity without solving the root cause