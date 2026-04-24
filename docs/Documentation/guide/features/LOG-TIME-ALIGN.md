# Feature Spec: Global Temporal Alignment (LOG-TIME-ALIGN)

To ensure accurate cross-source analysis during investigation, users must be able to normalize timestamps globally across the workspace when log sources originate from different timezones or machines with unsynchronized clocks.

## 1. Objective
Enable granular, workspace-wide time shifting for individual log sources. This ensures that logs from all sources interleave correctly in the unified timeline (Histogram, Search, and Fusion) by applying offsets at the ingestion/retrieval layer.

## 2. User Experience (UX)

### 2.1 Entry Point
In the **Orchestrator Hub**, users select the **"Time Alignment"** strategy. This opens a dedicated workspace-wide alignment panel independent of specific Fusion configurations.

### 2.2 Alignment Interface
The interface lists all log sources currently active in the workspace.
- **Clock Button**: Each source has a button showing its current offset (e.g., "+3600s").
- **Time Alignment Modal**: Clicking the button opens a modal to configure the shift.

#### Tab: Relative Shift
Allows the user to specify a fixed duration to add or subtract.
- **Inputs**: Offset in seconds.
- **Logic**: Positive values shift logs forward; negative values shift them backward.

### 2.3 Global Application
Clicking **"Apply Global Logic"** persists the offsets to the database. These offsets are automatically applied to every `get_logs` request, ensuring perfect synchronization across the entire platform.

## 3. Technical Requirements

### 3.1 Backend (Sidecar)
- **Database**: `temporal_offsets` table in DuckDB storing `(workspace_id, source_id, offset_seconds)`.
- **RPC Methods**:
  - `method_get_temporal_offsets`: Retrieves all configured offsets for a workspace.
  - `method_update_temporal_offsets`: Persists a list of offsets.
- **Core Logic**: `_get_logs_internal` in `api.py` automatically applies these offsets using `INTERVAL` arithmetic during data retrieval.

### 3.2 Frontend
- **Bridge**: Uses `callSidecar` to sync offsets.
- **State**: Managed locally in `OrchestratorHub.tsx` before being committed to the backend.
- **Component**: `TimeShiftModal` (Molecule) handles the granular input.

## 4. Acceptance Criteria
- [x] Users can configure offsets via a dedicated "Time Alignment" strategy.
- [x] Offsets are stored globally in DuckDB.
- [x] Log timestamps in the Histogram and Main Table reflect the applied offsets.
- [x] Fusion interleaving is correct without needing local Fusion-specific offsets.
- [x] The UI reverts to original state if cancellation is chosen.

---
**Status**: COMPLETED  
**Author**: @antigravity  
**Date**: 2026-04-17
