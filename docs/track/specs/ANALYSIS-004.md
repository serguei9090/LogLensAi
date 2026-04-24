# TODOC: ANALYSIS-004 - Anomaly Detection Engine

## Overview
Implement an automated outlier detection layer to help users identify "High Signal" events that differ from established log baselines.

## Logic Layers
1. **Statistical Outlier (Z-Score)**:
    - Sidecar calculates the mean frequency and standard deviation of every `cluster_id` over sliding time windows (e.g., last 1 hour vs last 24 hours).
    - If a cluster spikes beyond 3 standard deviations, it is flagged.
2. **Novelty Detection (Drain3)**:
    - Any new pattern discovered by Drain3 that hasn't appeared in the last N hours is marked as "NATIVE_NEW."

## Integration
- **Toggle**: Managed in the "Visual Layers" section of the **Orchestrator Hub**.
- **Visualization**:
    - **Chart**: Bars for anomalous time buckets are highlighted in Violet/Orange.
    - **Table**: Anomalous logs get a status badge (`Anomaly Detected`).

## Backend API
- `method_get_anomalies(workspace_id, time_range)`: Returns a list of `cluster_id` and `timestamp` pairs that exceed the threshold.
