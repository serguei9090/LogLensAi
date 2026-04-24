# TODO(PARS-004): Timezone Offset Normalization

## Context
Each source in a fusion can have an associated `tz_offset` (e.g., source A is UTC-5, source B is UTC+2). If the log timestamp doesn't include an offset, it must be normalized to UTC to enable interleaved sorting.

## Proposed Changes
1. **Logic Specification**:
   - IF `tz_offset` != 0:
     1. Take the parsed timestamp.
     2. Subtract the `tz_offset` (in hours) to obtain UTC.
     3. Save the resulting UTC ISO string as the `timestamp` column in the DuckDB `logs` table.
2. **Standardization**: This normalization happens AFTER parsing (`PARS-002`/`PARS-003`) but BEFORE DuckDB insertion.

## Roles
- **@backend** (Data Normalization)

## Files
- `sidecar/src/api.py`: Ingest path.
- `sidecar/src/tailer.py`: Live tail path.
- `sidecar/src/db.py`: Query builder (timestamp column definition).
