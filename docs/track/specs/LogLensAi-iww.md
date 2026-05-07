# Implementation Spec: Fix DuckDB Ingestion Crash and Orphaned Jobs

**Bead ID**: LogLensAi-iww
**Status**: COMPLETED (Backfilled)
**Persona**: @pm

## 1. Overview
This task addresses a critical failure in the log ingestion pipeline where the system would crash during log ingestion due to incompatible DuckDB SQL syntax (`last_insert_rowid()`). This crash left "zombie" ingestion jobs in the database, causing the UI to permanently show a "loading" state for clustering logs without any active progress.

## 2. Proposed Changes

### 2.1 DuckDB Compatibility Fix (sidecar/src/api.py)
- **Problem**: `SELECT last_insert_rowid()` is not a standard DuckDB scalar function and was throwing a `CatalogException`.
- **Solution**: Use the `INSERT ... RETURNING id` syntax which is natively supported by DuckDB for retrieving auto-incrementing primary keys in a single atomic operation.
- **Affected Function**: `method_ingest_logs`.

### 2.2 Transaction Safety (sidecar/src/api.py)
- **Problem**: Failures during bulk insertion would leave an entry in `ingestion_jobs` but no records in the `logs` table, causing processing stalls.
- **Solution**: Wrap the bulk insertion logic in a `try/except` block with an explicit `self.db.rollback()` on failure. This ensures the job record is either fully functional or removed.

### 2.3 Stalled Job Cleanup (sidecar/src/api.py)
- **New Method**: `method_cleanup_ingestion_jobs`.
- **Logic**: Automatically identify and delete jobs for a given workspace that have `processed_lines = 0` and are either marked `failed` or are older than 30 minutes.
- **Purpose**: Restore UI visibility by purging dead records that block the dashboard notification state.

## 3. Verification Plan

### 3.1 Sidecar Log Audit
- Verify that `CatalogException` is no longer present after ingestion attempts.
- Confirm `ClusteringWorker` logs show `Processing batch of X logs...` successfully.

### 3.2 JSON-RPC Verification
- Call `ingest_logs` via RPC and verify a valid `job_id` is returned.
- Call `get_logs` to confirm the records were persisted.
- Call `cleanup_ingestion_jobs` and verify orphaned records are removed from the `ingestion_jobs` table.

### 3.3 Visual Audit
- Use `tauri-mcp-server` to confirm the "Clustering Logs" notification clears after successful ingestion or manual cleanup.
