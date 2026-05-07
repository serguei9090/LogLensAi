# Implementation Spec: Dashboard Enhancement - Time-Series Ingestion & Severity Over Time

**Bead ID**: LogLensAi-8kv, LogLensAi-48o
**Status**: DRAFT
**Persona**: @pm

## 1. Overview
This specification covers the implementation of two high-priority dashboard charts:
1. **Time-Series Ingestion Volume**: Visualizing log frequency over time to identify spikes or outages.
2. **Severity Over Time**: Visualizing the distribution of log levels (ERROR, WARN, INFO, etc.) across the time axis.

These charts will be integrated into the `DashboardPage` and supported by expanded metrics in the `get_dashboard_stats` sidecar method.

## 2. Proposed Changes

### 2.1 Backend (Sidecar)
- **File**: `sidecar/src/api.py`
  - Update `method_get_dashboard_stats` to return time-bucketed data.
  - **Logic**:
    - Determine a suitable interval (e.g., 1 minute, 5 minutes, 1 hour) based on the current `start_time` and `end_time` window.
    - Execute a query to count logs and group by bucket and level.
    ```sql
    SELECT 
        strftime('%Y-%m-%d %H:%M:00', l.timestamp) as bucket, 
        l.level, 
        COUNT(*) as count 
    FROM logs l
    {where_sql}
    GROUP BY bucket, l.level
    ORDER BY bucket ASC
    ```
  - **Return Format**:
    ```json
    "time_series": [
        {"timestamp": "2026-05-06 20:00:00", "INFO": 100, "WARN": 5, "ERROR": 1},
        ...
    ]
    ```

### 2.2 Frontend (React)
- **File**: `src/components/pages/DashboardPage.tsx`
  - Update `DashboardStats` interface to include `time_series`.
  - Add two new chart components (using Recharts or similar library already in use, or standard SVG/CSS if lightweight is preferred).
  - **Chart 1: Ingestion Volume**: An Area chart showing the sum of all logs per bucket.
  - **Chart 2: Severity Over Time**: A Stacked Bar or Stacked Area chart showing levels over time.

- **UI Integration**:
  - Insert a new row below the `StatCard` grid.
  - Layout: `Ingestion Volume` (2/3 width) and `Severity Breakdown` (1/3 width, or side-by-side).

## 3. Verification Plan

### 3.1 Automated Tests
- **Backend**: `sidecar/tests/test_api_dashboard.py`
  - Add test case verifying `time_series` data structure and bucket alignment.
- **Frontend**: `src/__tests__/DashboardPage.test.tsx`
  - Verify charts render when data is present.

### 3.2 Manual Verification
- Ingest a batch of logs with varying timestamps.
- Open Dashboard and verify charts reflect the ingestion pattern.
- Change the filter window (e.g., "Last 1 Hour") and verify the chart reloads with correct data.
