# Specification: Ingestion & Auto-Facets Overhaul

## 🎯 Objective
Eliminate the primary performance bottlenecks in LogLensAi by moving from a DB-UPDATE architecture to a **RAM-First Bulk-Insert** pipeline, and replacing heavy default regexes with **Drain3 Auto-Facets**.

## 🏗️ Architectural Shifts
1. **No More Updates:** Logs will be processed (Metadata Extraction + Clustering) *before* they touch the DuckDB SQL engine. They will be inserted fully formed.
2. **Auto-Facets:** We will use `miner.extract_parameters()` from Drain3 to automatically map masked variables (like IPs, Numbers, Hex) into queryable facets.
3. **Custom Rules Maintained:** The user's custom regex rules will remain intact and will be applied alongside the auto-facets.

---

## 📋 Implementation Plan

### Phase 1: Drain3 Auto-Facets Integration
*   **Target:** `sidecar/src/metadata_extractor.py` and `sidecar/src/parser.py`
*   **Action:** 
    *   Update `metadata_extractor.py` to remove the heavy default regexes (IPs, UUIDs, generic key-values) that cause CPU drag. 
    *   Keep only the absolute essentials: Timestamp parsing and Log Level extraction.
    *   Update `parser.py` and the worker logic to call `match_result.extract_parameters()`.
    *   Map the Drain3 mask labels (e.g., `<IP>`, `<NUM>`) to dynamic facet keys in the JSON blob.

### Phase 2: RAM-First Ingestion Pipeline (Local Files)
*   **Target:** `sidecar/src/ingestion.py`
*   **Action:**
    *   Refactor `_bg_ingest_local_file`.
    *   **New Flow:**
        1. Read chunk of logs (e.g., 5000 lines).
        2. Write to `FastPath` (for UI memory mapping).
        3. Dispatch chunk to the parallel tagging engine (`_tag_log_batch` from `clustering.py`).
        4. Collect the tagged results (which now include `cluster_id` and `auto-facets`).
        5. Execute a single `INSERT INTO logs` with the complete row data.
    *   This completely bypasses the need for the `ClusteringWorker` to fetch unprocessed rows from DuckDB and run `UPDATE` statements.

### Phase 3: Adapting Streaming Ingestion (HTTP/Syslog)
*   **Target:** `sidecar/src/ingestion.py` (Streaming endpoints)
*   **Action:**
    *   Apply the same RAM-first logic to streaming data. When a stream buffer flushes (e.g., every 500ms or 100 lines), it must be clustered and metadata-extracted *in memory* before being inserted into DuckDB.

### Phase 4: Deprecating the Old Worker Logic
*   **Target:** `sidecar/src/workers/clustering.py`
*   **Action:**
    *   The `ClusteringWorker` loop will no longer need to hunt for `processed = FALSE` logs because all logs will be processed at ingestion.
    *   Repurpose `ClusteringWorker` strictly as a "Re-clustering" engine (used only when the user changes rules and explicitly requests a re-cluster of existing historical DB data).
    *   Clean up the UI progress tracking to look at a single `ingestion_jobs` metric, since "Ingesting" and "Clustering" are now the exact same step.

## 🚀 Expected Impact
*   **Speed:** Log ingestion speed should jump from ~600 lines/sec to **10,000 - 30,000+ lines/sec**, matching the benchmark.
*   **CPU/Disk:** Vastly reduced disk I/O (no DuckDB WAL bloat from updates).
*   **Maintainability:** Less complex SQL state management.