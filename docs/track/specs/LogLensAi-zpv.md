# Implementation Spec: Dashboard Enhancement - Pattern Drift & Top Error Clusters

**Bead ID**: LogLensAi-zpv, LogLensAi-2s8
**Status**: DRAFT
**Persona**: @pm

## 1. Overview
This specification covers two pattern-based dashboard features:
1. **Template Drift / New Patterns**: Visualizing when new log templates (clusters) are discovered by Drain3.
2. **Top Error Clusters**: A focused list of the most frequent patterns with high severity (ERROR/FATAL).

## 2. Proposed Changes

### 2.1 Backend (Sidecar)
- **File**: `sidecar/src/api.py`
  - **Pattern Drift**: 
    - Update `get_dashboard_stats` to include a count of clusters created within the current time window.
    - Optional: Return a trend (e.g., "3 new patterns in last hour").
  - **Top Error Clusters**:
    - Add a new query to `get_dashboard_stats` specifically for high-severity logs.
    ```sql
    SELECT 
        COALESCE(c.template, 'Pattern ' || l.cluster_id) as template,
        COUNT(*) as count
    FROM logs l
    LEFT JOIN clusters c ON l.cluster_id = c.id
    {where_sql} AND l.level IN ('ERROR', 'FATAL', 'CRITICAL')
    GROUP BY l.cluster_id, c.template
    ORDER BY count DESC
    LIMIT 5
    ```

### 2.2 Frontend (React)
- **File**: `src/components/pages/DashboardPage.tsx`
  - **Template Drift Card**:
    - Add a small card showing "New Templates Detected".
    - Design: Similar to `StatCard` but with a trend indicator.
  - **Top Error Clusters Card**:
    - Create a dedicated section for "Critical Issues".
    - Use a red-themed list layout to distinguish it from the general "Noise Generators" list.

## 3. Verification Plan

### 3.1 Automated Tests
- **Backend**: `sidecar/tests/test_api_dashboard.py`
  - Verify `error_clusters` results only contain relevant levels.
  - Verify `new_clusters_count` correctly reflects timestamps of cluster creation.

### 3.2 Manual Verification
- Ingest logs that trigger a *new* Drain3 cluster.
- Verify the "Pattern Drift" card updates.
- Ingest high-severity logs and verify they appear in the "Top Error Clusters" list.
