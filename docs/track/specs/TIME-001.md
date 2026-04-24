# Task Detail: Time Normalization & Alignment (TIME-001)

## Context
Fusing logs from multiple sources often fails to interleave correctly due to:
1. **Timezone differences**: One server logs in UTC, another in EST.
2. **Clock skew**: A legacy server is 20 seconds behind the load balancer.
3. **Log transport delay**: Remote logs arriving via SSH tail might have parsed timestamps that don't match the investigator's local context.

## Proposed Implementation

### 1. Data Contract
The `FusionSourceConfig` needs to support a granular delta.
```python
class FusionSourceConfig(BaseModel):
    # ...
    tz_offset: int = 0  # Coarse: Hourly shift
    time_shift_seconds: int = 0  # Granular: Total seconds shift (+/-)
```

### 2. Normalization Engine (`api.py`)
Update `method_get_fused_logs` to apply both shifts:
```python
dt = dt + timedelta(hours=offset, seconds=time_shift_seconds)
```

### 3. Frontend: Sample-to-Delta Logic
In the UI, if a user wants to align `Source A` to `Source B`:
1. Pick a line in `A`: `12:00:00`
2. Pick a line in `B`: `12:00:20` (that is logically the same event)
3. UI calculates: `B - A = +20 seconds`
4. Store `20` in `time_shift_seconds` for Source A.

### 4. UI components
- `OrchestratorHub`: New `Clock` icon button in the source list.
- `TimeAlignmentModal`: 
    - Toggle: "Shift by Duration" vs "Align to Reference".
    - Save button updates the `configs` array in OrchestratorHub state.

## Considerations
- **Performance**: Timestamp parsing/shifting in `api.py` occurs for every log line in the result set. Keep it efficient.
- **Persistence**: DuckDB `fusion_configs` table must be altered or handles the new column gracefully if we use a flexible JSON field for "extra_config" (Wait, current schema is fixed columns, I should use `ALTER TABLE`).

---
**Status**: OPEN  
**Sprint**: 06
