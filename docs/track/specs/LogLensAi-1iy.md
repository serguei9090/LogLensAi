# Implementation Spec: Asynchronous Log Ingestion & Resumable Clustering

**Bead ID**: LogLensAi-1iy, LogLensAi-gqy
**Status**: DRAFT
**Persona**: @pm

## 1. Overview
The current log ingestion pipeline is synchronous and blocking. High-volume ingestion (10k+ lines) can time out or be lost if the application reloads, as Drain3 clustering happens on-the-fly.
This spec introduces a **Fire-and-Forget Ingestion** model where logs are immediately persisted as "Unprocessed", and a background worker performs Drain3 clustering asynchronously.

## 2. Proposed Changes

### 2.1 Database Schema (`sidecar/src/db.py`)
- **Table: `logs`**
  - Ensure `cluster_id` can be `NULL` (indicating unprocessed).
  - Add `processed` (BOOLEAN, default FALSE) index for fast lookup of pending logs.
- **Table: `ingestion_jobs` (New)**
  - `id` (UUID/INT)
  - `workspace_id` (TEXT)
  - `status` (TEXT: 'pending', 'processing', 'completed', 'failed')
  - `total_lines` (INT)
  - `processed_lines` (INT)
  - `last_log_id` (INT: Checkpoint for resumability)
  - `created_at` (TIMESTAMP)

### 2.2 Backend (Sidecar)
- **`method_ingest_logs` (`api.py`)**
  - Remove Drain3 parsing from the ingestion loop.
  - Perform metadata extraction (timestamp/level) but leave `cluster_id` as NULL.
  - Create an `ingestion_jobs` entry.
  - Return immediately to the frontend.
- **`ClusteringWorker` (New: `sidecar/src/workers/clustering.py`)**
  - A background thread/task that polls for logs with `processed = FALSE`.
  - Processes logs in batches (e.g., 500 lines).
  - Updates Drain3 clusters and templates.
  - Updates `logs` with `cluster_id` and sets `processed = TRUE`.
  - Updates `ingestion_jobs` with progress/checkpoint.
  - **Resumability**: On startup, the worker scans for any `processed = FALSE` logs and picks up where it left off.

### 2.3 Frontend (React)
- **`DashboardPage.tsx`**
  - Add a "Processing Status" indicator/bar if background jobs are active.
  - Display "Clustering Progress: 4,500 / 10,000 lines".

## 3. Verification Plan

### 3.1 Automated Tests
- Ingest 1000 logs and verify the RPC returns before clustering is complete.
- Verify the worker eventually marks all 1000 logs as `processed`.
- Simulate a sidecar crash during processing and verify it resumes from the last checkpoint on restart.

### 3.2 Manual Verification
- Upload a large log file.
- Close/Reload the app immediately after upload.
- Verify that logs are visible in the table and eventually get their Cluster IDs/Templates.
