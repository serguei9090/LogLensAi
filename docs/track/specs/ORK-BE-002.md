# TODO(ORK-BE-002): Multi-Fusion Log Query Support

## Context
As multiple fusions (e.g., "Prod", "Test") are now stored by `fusion_id`, the log retrieval method `get_fused_logs` must be able to fetch the sources associated with a specific fusion.

## Proposed Changes
1. **API Method**: `get_fused_logs(workspace_id, fusion_id, offset, limit, ...)`
2. **Logic Override**:
   - IF `fusion_id` is provided:
     1. Retrieve sources list associated with `(workspace_id, fusion_id)` from `fusion_configs`.
     2. Filter the overall logs query to ONLY include `source_id`'s from that config.
   - ELSE:
     1. Fallback to current behavior: Retrieve all enabled sources for that `workspace_id`.
3. **Optimized Join**: Ensure the underlying DuckDB query correctly joins with the `logs` table using the filtered list.

## Roles
- **@backend** (Logic & API)

## Files
- `sidecar/src/api.py`: Log fetching logic.
- `sidecar/src/db.py`: Query builders.
