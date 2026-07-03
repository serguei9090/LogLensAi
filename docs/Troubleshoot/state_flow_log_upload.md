# Log Upload State Flow - Troubleshoot Diagram

## Issue: State Management Bug During Concurrent Uploads

When switching sources while ingestion jobs are running, the UI loses state and the "Indexing" overlay disappears immediately, showing an empty table instead of waiting for logs to populate.

## State Machine Diagram (Mermaid)

```mermaid
stateDiagram-v2
    [*] --> Idle
    Idle --> Uploading_Local_File: handleImportLocal(sourceId)
    Idle --> Uploading_SSH: handleImportSSH(sourceId)
    Idle --> Uploading_Manual: handleIngestManual(sourceId)
    
    Uploading_Local_File --> Transitioning: addTransitioningSource(sourceId)
    Uploading_Local_File --> Ingesting: startIngestion(sourceId)
    Uploading_Local_File --> Fetching_Logs: fetchLogs()
    
    Transitioning --> Polling: startPolling(workspaceId)
    Ingesting --> Processing: job.status === "processing"
    
    Processing --> Completed: job.status === "completed"
    Processing --> Failed: job.status === "failed"
    
    Completed --> Retrieving_Logs: Fetch triggered
    Retrieving_Logs --> Logs_Loaded: fetchLogs().finally()
    
    Retrieving_Logs --> [*]: BUG - clearState() wipes state during source switch
    Fetching_Logs --> [*]: State lost when switching sources mid-stream
    
    state Polling {
        [*] --> Active
        Active --> Self_Terminate: !activeJob && !liveSourceCount
        Self_Terminate --> [*
    }
    
    note right of Retrieving_Logs
        BUG: When user switches source while
        job is in this state, clearState() is
        called, wiping jobs: [] and notifiedJobIds
    end note
```

## Sequence Diagram: Log Upload Flow

```mermaid
sequenceDiagram
    participant User
    participant InvestigationPage
    participant useLogIngestion
    participant useIngestionStore
    participant Sidecar

    User->>InvestigationPage: Select source A
    InvestigationPage->>User: Show source selector
    User->>useLogIngestion: handleImportLocal(file)
    
    useLogIngestion->>useIngestionStore: addTransitioningSource(sourceId)
    useLogIngestion->>useIngestionStore: startIngestion(sourceId)
    useLogIngestion->>useInvestigationStore: setLogs([], 0)
    
    useLogIngestion->>Sidecar: ingest_local_file()
    Sidecar-->>useLogIngestion: {job_id, status, total_lines}
    
    useLogIngestion->>useIngestionStore: addOrUpdateJob(newJob)
    useLogIngestion->>useIngestionStore: startPolling(workspaceId)
    
    InvestigationPage->>InvestigationPage: isSourceLoading = true
    InvestigationPage->>User: Show "Indexing" overlay
    
    loop Polling Loop (every 1-3s)
        useIngestionStore->>Sidecar: get_ingestion_jobs()
        Sidecar-->>useIngestionStore: [job with status]
        useIngestionStore->>InvestigationPage: Update jobs state
    end
    
    alt User switches source mid-ingestion
        User->>InvestigationPage: handleSelectSource(sourceId)
        InvestigationPage->>InvestigationPage: Check currentJob for activeSourceId
        InvestigationPage->>useIngestionStore: addTransitioningSource(activeSourceId)
        
        Note over InvestigationPage,useIngestionStore: BUG RACE CONDITION
        
        InvestigationPage->>useWorkspaceStore: setActiveSource(sourceId)
        useWorkspaceStore->>useInvestigationStore: Clear logs for old source
        useInvestigationStore->>InvestigationPage: Logs cleared
        
        InvestigationPage->>InvestigationPage: useEffect triggers clearState()
        InvestigationPage->>useIngestionStore: clearState()
        
        Note right of useIngestionStore: clearState wipes:
        Note right of useIngestionStore: - jobs: []
        Note right of useIngestionStore: - transitioningSourceIds: Set()
        Note right of useIngestionStore: - ingestingSourceIds: []
        
        InvestigationPage->>InvestigationPage: isSourceLoading = false
        InvestigationPage->>User: Overlay disappears, shows empty table
    end
    
    alt Job completes normally
        Sidecar-->>useIngestionStore: {status: "completed", processed_lines}
        useIngestionStore->>useIngestionStore: Check notifiedJobIds
        useIngestionStore->>InvestigationPage: setActiveSource(state) complete
        useIngestionStore->>InvestigationPage: setRetrievingSourceIds(activeSourceId)
        InvestigationPage->>useLogFetching: fetchLogs({forceFull: true})
        useLogFetching->>Sidecar: get_logs()
        Sidecar-->>useLogFetching: {total, logs}
        useLogFetching->>InvestigationPage: Logs populated
        InvestigationPage->>User: Table shows logs
    end
```

## State Variables Map

### ingestionStore.ts

| Variable | Purpose | Set By | Cleared By |
|----------|---------|--------|------------|
| `jobs` | All ingestion jobs | `fetchJobs()`, `addOrUpdateJob()` | `clearState()`, rehydration |
| `activeJob` | Currently processing job | `fetchJobs()` | `clearState()` |
| `ingestingSourceIds` | Sources in startIngestion | `startIngestion()` | `stopIngestion()`, `clearState()` |
| `transitioningSourceIds` | Sources between ingest call and first poll | `addTransitioningSource()` | `removeTransitioningSource()`, `clearTransitioningJobs()` |
| `liveSourceCount` | Active tails/SSH streams | `addLiveSource()` | `removeLiveSource()` |
| `notifiedJobIds` | Jobs that triggered toast | `fetchJobs()`, `addOrUpdateJob()` | `clearState()` |

### investigationStore.ts

| Variable | Purpose | Set By | Cleared By |
|----------|---------|--------|------------|
| `logs` | Loaded log entries | `setLogs()`, `fetchLogs()` | `clearState()`, source/workspace change |
| `total` | Total log count | `setLogs()` | Source/workspace change |
| `isFetching` | Log fetch in progress | `useLogFetching` | On fetch complete/error |

## Critical Paths & Race Conditions

### Path 1: Normal Upload → Completion
```
handleImportLocal()
  → addTransitioningSource(sourceId)
  → startIngestion(sourceId)           # ingestingSourceIds += [sourceId]
  → ingest_local_file() [sidecar]
  → addOrUpdateJob(job)              # jobs += [job], job.status = "queued"
  → startPolling(workspaceId)
  → poll loop: fetchJobs()          # job.status → "processing" → "completed"
  → isSourceLoading = true (ingestingSourceIds.includes)
  → job completes
  → setRetrievingSourceIds(sourceId)  # Keep overlay up
  → fetchLogs({forceFull: true})
  → logs populated
  → setRetrievingSourceIds(sourceId) cleared
```

### Path 2: Source Switch During Ingestion (BUG PATH)
```
User switches source while job.status === "processing"
  → handleSelectSource(newSourceId)
  → addTransitioningSource(activeSourceId)  # Track the switch
  → setActiveSource(newSourceId)
  → useEffect: setLogs([], 0)               # Clears old logs immediately
  → clearState() called                      # CRITICAL BUG
  → jobs = []                               # WIPED!
  → transitioningSourceIds = Set()          # WIPED!
  → isSourceLoading = false                 # Overlay disappears
  → Empty table shown instead of waiting
```

### Path 3: Job Completes But Processed_Lines = 0
```
Job completes in < 1s (fast machine)
  → Frontend polls after job done
  → fetched job has processed_lines = 0
  → Frontend thinks job is still "queued"
  → isSourceLoading = false (no active job detected)
  → Overlay disappears before fetchLogs returns
```

## Key Fix Points

### 1. Prevent clearState During Active Jobs
```typescript
// In InvestigationPage.tsx - useEffect for source/workspace changes
if (!activeJob && !transitioningSourceIds.has(activeSourceId)) {
  setLogs([], 0);  // Only clear if no active ingestion
}
```

### 2. Preserve transitioningSourceIds During Source Switch
```typescript
// In handleSelectSource
const currentJob = jobs.find(j => 
  j.source_id === activeSourceId && 
  j.status !== "completed" && 
  j.status !== "failed"
);
if (currentJob) {
  addTransitioningSource(activeSourceId);  // Track for next source
}
```

### 3. Check Any Active Pollers Before Clearing
```typescript
// In clearState
clearTransitioningJobs();  // Not full clear
// Keep jobs and ingestingSourceIds if jobs are active
```

## Debugging Checklist

- [x] Verify `transitioningSourceIds` is persisted when source changes (Done - Guarded inside page state effects)
- [x] Check `isSourceLoading` includes `transitioningSourceIds.has(activeSourceId)` (Done)
- [x] Confirm `clearState()` is not called during active ingestion (Done - `clearState` now preserves active/processing jobs)
- [x] Validate `fetchLogs` promise resolves before overlay clears (Done)
- [x] Test with large file on fast machine (job < 1s) (Done - Ingestion complete sets retrieving state to block early drops)
- [x] Test with concurrent uploads to different sources (Done)
- [x] Verify pollSessions map prevents duplicate polling loops (Done)