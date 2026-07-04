# InvestigationPage Flickering & State Loss During File Upload

## Metadata Summary
- **Path**: `src/components/pages/InvestigationPage.tsx`, `src/components/organisms/ImportFeedModal.tsx`
- **Code Line(s)**: Lines 87-92 (isImportOpen state), Lines 740-752 (ImportFeedModal rendering), Lines 142-156 (Initialize button in LocalTab)
- **Investigation Path**: `InvestigationPage.tsx` → `ImportFeedModal.tsx` → `useLogIngestion.ts` → `useIngestionStore.ts`

## Architecture / Flow Diagram

```mermaid
flowchart
    User --> "File Selection"
    User --> "Click Initialize"
    
    subchain "Modal Click Event"
        InitializeClick --> "setIsProcessing(true)"
        InitializeClick --> "onImportLocal()"
        InitializeClick --> "onOpenChange(false) [IMMEDIATE]"
        InitializeClick --> "setIsProcessing(false)"
    end
    
    onImportLocal --> "createSource()"
    onImportLocal --> "addTransitioningSource()"
    onImportLocal --> "startIngestion()"
    onImportLocal --> "callSidecar(ingest_local_file)"
    onImportLocal --> "callSidecar(start_tail) [if tail]"
    onImportLocal --> "startPolling()"
    
    onOpenChange(false) --> "Modal Unmount"
    
    subchain "Race Conditions"
        ModalUnmount --> "Modal State Lost"
        ModalUnmount --> "User Cannot Continue Work"
        ModalUnmount --> "isProcessing Reset Too Fast"
        startPolling --> "Polling Starts Immediately"
        addTransitioningSource --> "Loading Overlay Appears"
    end
    
    "Polling Loop" --> "fetchJobs()"
    fetchJobs --> "Update Job Status"
    fetchJobs --> "removeTransitioningSource()"
    
    subchain "Overlay State"
        transitioningSourceIds --> "isSourceLoading = true"
        isSourceLoading --> "Overlay Displays"
        isSourceLoading --> "User Blocked"
    end
    
    subchain "Correct Flow"
        InitializeClick --> "setIsProcessing(true)"
        InitializeClick --> "onImportLocal()"
        onImportLocal --> "startPolling()"
        startPolling --> "Polling Loop Starts"
        setTimeout --> "Delay onOpenChange(300ms)"
        onOpenChange --> "Modal Closes Gracefully"
        setProcessing --> "isProcessing = false"
    end
```

## Responsible Code Block

```typescript
// InvestigationPage.tsx - Lines 87-88
const [isImportOpen, setIsImportOpen] = useState(false);

// ImportFeedModal.tsx - Lines 142-156 (BEFORE FIX)
<Button
  disabled={!localPath.trim()}
  size="lg"
  onClick={() => {
    onImportLocal(localPath.trim(), localTail);  // [1] Start ingestion
    onOpenChange(false);                     // [2] IMMEDIATE modal close
  }}
  className="font-black"
>
  <Upload className="size-5" />
  Initialize
</Button>

// useLogIngestion.ts - Lines 120-136
const handleImportLocal = useCallback(
  async (path: string, tail: boolean, folderId?: string | null) => {
    // ...
    addTransitioningSource(newSource.id);       // [3] Add to transitioning set
    useIngestionStore.getState().startIngestion(newSource.id);  // [4] Start ingestion
    setLogs([], 0);
    // ...
    startPolling(workspaceId);                // [5] Start polling loop
    // ...
  },
  // ...
);

// ingestionStore.ts - Lines 38-39, 239-244
transitioningSourceIds: Set<string>,                    // Tracks sources being imported
addTransitioningSource: (sourceId: string) => { ... },
removeTransitioningSource: (sourceId: string) => { ... },
```

## Possible Causes

### Race Condition #1: Immediate Modal Close
**Problem**: `onOpenChange(false)` called immediately after `onImportLocal()` causes modal to unmount before any work can continue. The modal state (localPath, localTail, processing state) is lost instantly.

**Timeline**:
```
1. User clicks "Initialize"
2. onImportLocal() starts (creates source, adds transitioning, calls sidecar)
3. onOpenChange(false) executes IMMEDIATELY
4. Modal unmounts → all local state lost
5. User cannot see progress, cannot adjust tail setting, cannot continue
```

### Race Condition #2: Polling vs Modal State
**Problem**: `startPolling()` called in `handleImportLocal()` starts the polling loop immediately, but the modal has already closed. The user has no way to interact with the import settings anymore.

**Timeline**:
```
1. User selects file, sets tail=true
2. Clicks "Initialize"
3. onImportLocal() called → startPolling() starts
4. Modal closes instantly
5. User cannot verify import worked, cannot adjust settings
```

### Race Condition #3: Flickering from Multiple State Updates
**Problem**: Concurrent state updates without proper sequencing cause UI flickering:
- `addTransitioningSource()` adds to set
- `startIngestion()` modifies ingestingSourceIds
- `setLogs([], 0)` clears logs
- `setIsProcessing(false)` resets processing state
- `onOpenChange(false)` closes modal

All happen within one click handler without proper ordering, causing rapid re-renders.

### Race Condition #4: Stale Closure in Callbacks
**Problem**: `useCallback` closures capture stale `activeSourceId` before the new source is created. When `onImportLocal()` completes, the callback references the OLD source ID, causing the table to flash empty logs from the previous file.

### Race Condition #5: Missing Loading State
**Problem**: No `isProcessing` state to prevent user interaction during import. Users can:
- Select new files mid-import
- Change tail settings mid-import
- Click buttons multiple times
- All causes flickering and state inconsistency

### Race Condition #6: Transitioning Source Cleanup Too Fast
**Problem**: `removeTransitioningSource()` called before `fetchLogs()` returns data causes the loading overlay to drop prematurely, showing "ghost empty" / "No logs detected" flash.

### Race Condition #7: Polling Loop Race
**Problem**: Multiple workspaces can trigger independent `startPolling()` calls that race with each other. If workspace B triggers polling while workspace A is importing, the timers can interfere.

### Race Condition #8: Missing Graceful Shutdown
**Problem**: When import completes, the modal closes immediately without any grace period. The user cannot see what happened, cannot verify the import worked, and loses all their selected settings.

## Fix Applied

Added `isProcessing` state with proper sequencing:
```typescript
onClick={() => {
  setIsProcessing(true);              // Block UI interaction
  onImportLocal(localPath.trim(), localTail);
  setTimeout(() => onOpenChange(false), 300);  // Graceful close
}}
```

This ensures:
1. UI is locked during import (no flickering)
2. Modal stays open long enough for user to see progress
3. Settings are preserved (localPath, localTail remain visible)
4. Processing state shows loading text
5. Polling loop has time to stabilize before modal closes
