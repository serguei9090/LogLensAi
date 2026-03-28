# TODOC: ANALYSIS-001 - Toggleable Log Distribution View

## Overview
Implement a high-performance timeline histogram in the Investigation tab, controlled via the Orchestrator Hub. This allows users to see log density and level distribution over time without cluttering the main grid.

## Architectural Specs
- **Logic Placement**:
    - **Backend**: `sidecar/src/api.py` -> `method_get_log_distribution`.
    - **Frontend**: `src/store/investigationStore.ts` -> `showDistribution` toggle.
- **Data Flow**:
    1. User toggles "Log Distribution" in Orchestrator Hub.
    2. Frontend requests bucketed aggregates from DuckDB.
    3. Backend uses `time_bucket` to group logs by time + level.
- **UI/UX**:
    - Appears between Toolbar and Log Table.
    - Bars are color-coded by log level (Error, Warn, Info).
    - Brush-selection on the chart updates the global `time_range` filter.

## Dependencies
- `visx` or `recharts` (lightweight SVG charting).
- DuckDB `time_bucket` extension.
