# Implementation Spec: Dashboard Enhancement - Source Heatmap & AI Insight Snippet

**Bead ID**: LogLensAi-6nw, LogLensAi-8tj
**Status**: DRAFT
**Persona**: @pm

## 1. Overview
This specification covers the final two dashboard enhancements:
1. **Source/Catalog Heatmap**: Visualizing activity density across different log sources.
2. **AI Insight Summary Snippet**: A proactive teaser card showing the most recent automated analysis findings.

## 2. Proposed Changes

### 2.1 Backend (Sidecar)
- **File**: `sidecar/src/api.py`
  - **Source Heatmap**:
    - Add a query to `get_dashboard_stats` to count logs per source and per time bucket.
    - Return a matrix of `source_id` vs `bucket`.
  - **AI Insight Snippet**:
    - Add logic to fetch the latest summary from `ai_messages` or trigger a lightweight heuristic check if no messages exist.
    - Return a `latest_insight` string and a `severity_score` (0-100).

### 2.2 Frontend (React)
- **File**: `src/components/pages/DashboardPage.tsx`
  - **Heatmap Card**:
    - Implement a grid-based visualization where color intensity represents log volume.
    - Tooltip should show `source_name` and exact `count`.
  - **AI Insight Card**:
    - Add a "proactive" card at the top or bottom of the dashboard.
    - It should display the snippet and a "Deep Dive" button that switches the dashboard to `AI Mode`.

## 3. Verification Plan

### 3.1 Automated Tests
- **Backend**: `sidecar/tests/test_api_dashboard.py`
  - Verify `source_activity` matrix is correctly structured.
  - Verify `latest_insight` correctly pulls from the most recent AI session.

### 3.2 Manual Verification
- Ingest logs from multiple sources and verify the heatmap accurately reflects the busiest source.
- Run an AI investigation, then return to the dashboard and verify the summary snippet is updated.
