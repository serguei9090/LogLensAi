# FUSION-DEBT-01: Automatic Clock Drift Compensation

**Status:** Backlog
**Target:** Log Fusion Engine
**Priority:** Medium/High

## Context
When merging logs from multiple distributed servers, clock drift across the servers can result in an interleaved timeline that misrepresents the actual sequence of events. While we currently provide manual Time Normalization (TimeShiftModal) allowing users to shift timestamps by explicit seconds or reference log pairs, this requires manual user intervention.

## Architectural Debt
The manual timezone shifting is error-prone and tedious for investigations involving many servers. We lack an automated "Clock Drift Compensation" algorithm.

## Proposed Solution
1. **Anchor Point Detection**: Identify high-confidence cross-system events (e.g., an HTTP request leaving Server A and arriving at Server B) using shared correlation IDs, request IDs, or specific signature sequences.
2. **Delta Calculation**: Compute the `delta_time = arrival_time_B - departure_time_A - estimated_network_latency`.
3. **Automated TimeShift**: Automatically apply this calculated delta to all logs from Server B relative to Server A in the `get_fused_logs` backend endpoint.
4. **UI Integration**: In the Orchestrator Hub or TimeShiftModal, add an "Auto-Align by Correlation" button that queries the backend to execute this calculation and set the `time_shift_seconds` configuration.

## Implementation Notes
- DuckDB's temporal functions will be used to apply the shift, similar to the manual shift implementation.
- Finding the anchor points will likely require scanning a subset of logs (e.g., first 10,000 logs) to find matching correlation IDs.
- The `time_shift_seconds` field on `FusionSourceConfig` is already built and ready to receive these automated values.
