# Feature Spec: Global Temporal Filtering (FEA-002)

## 🎯 Objective
Enable users to filter all log data (Table, Distribution, Anomalies) based on a unified global time range, ensuring a synchronized investigation across all views.

## 🏗️ Technical Architecture

### 1. State Management (`src/store/investigationStore.ts`)
- The `timeRange` state is already present in `investigationStore`.
- No changes needed here, just consistent usage.

### 2. UI/UX Migration
- **LogToolbar**: Move the `TimeRangePicker` from the `LogDistributionWidget` to the `LogToolbar`.
- **Visibility**: The time range should always be visible and editable, regardless of whether the distribution chart is open.
- **LogDistributionWidget**: Remove the local `TimeRangePicker` to avoid redundancy and prevent dual-picker confusion.

### 3. Backend Integration (`sidecar/src/api.py`)
- Standardize ISO date normalization in `_get_logs_internal`.
- Ensure `get_log_distribution` handles the same normalization.

### 4. Synchronization Flow
1. User changes range via `TimeRangePicker` (now in `LogToolbar`).
2. `setTimeRange` is called on the store.
3. `InvestigationPage` detects `timeRange` change via `useEffect` dependency.
4. `fetchLogs` is triggered with new `start_time` and `end_time`.
5. `LogDistributionWidget` (if open) detects `timeRange` change and re-fetches its buckets.

## ✅ Acceptance Criteria
- [ ] `TimeRangePicker` appears in the global top toolbar.
- [ ] Changing the time range triggers a reload of the log table.
- [ ] Changing the time range triggers a reload of the distribution chart.
- [ ] Range selection is preserved across view toggles (Distribution ON/OFF).
- [ ] The "Booking" dual-calendar navigation works seamlessly with the filter.

## 📅 Plan (TODO Index)
- `FEA-002-UI-001`: Migrate `TimeRangePicker` to `LogToolbar`.
- `FEA-002-UI-002`: Remove redundant picker from `LogDistributionWidget`.
- `FEA-002-BE-001`: Audit `api.py` timestamp parsing for ISO parity.
