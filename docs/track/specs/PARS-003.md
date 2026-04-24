# TODO(PARS-003): Live Tail Parser Integration

## Context
When a log file is tailing (`FileTailer` in `sidecar/src/tailer.py`), it currently inserts into DuckDB using a default parsing logic (simple regex for common patterns). For files that are part of a fusion, it must use the custom regex from that fusion's config.

## Proposed Changes
1. **Source Lookup**: `FileTailer` needs to be aware of the `parser_config` for the `filepath` it is tracking.
2. **Logic Specification**:
   - `tailer.py` `on_line(raw_line)` hook:
     1. Retrieve the `parser_config` for this file (queried from `fusion_configs`).
     2. Call `parser.apply_custom_config(...)` to get structured data.
     3. Insert resulting `timestamp`, `level` into the `logs` table.
3. **Optimized Threading**: Ensure that this lookup happens efficiently (e.g., cached or passed at tail start) to avoid database overhead per line.

## Roles
- **@backend** (Concurrency & Data Integration)

## Files
- `sidecar/src/tailer.py`: Tailer loop update.
- `sidecar/src/parser.py`: Implementation of parsing logic.
