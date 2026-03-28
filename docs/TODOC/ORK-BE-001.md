# TODO(ORK-BE-001): Multi-Fusion Database Schema Update

## Context
Currently, the `fusion_configs` table in `sidecar/src/db.py` uses `workspace_id` as the primary key or unique identifier. This means only one fusion configuration can exist per workspace. The new UI allows creating multiple named fusions (e.g., "Production Stack", "Security Audit").

## Proposed Changes
1. **Database Schema**: Update the `fusion_configs` table to include a `fusion_id` column.
2. **Schema Definition**: 
   ```sql
   CREATE TABLE IF NOT EXISTS fusion_configs (
     workspace_id TEXT,
     fusion_id TEXT,
     sources JSON,
     PRIMARY KEY (workspace_id, fusion_id)
   );
   ```
3. **API Updates**:
   - `update_fusion_config`: Must accept `fusion_id`.
   - `get_fusion_config`: Must accept `fusion_id`.

## Roles
- **@backend** (Logic & DB)
- **@architect** (Schema Contract)

## Files
- `sidecar/src/db.py`: Table creation and helper methods.
- `sidecar/src/api.py`: JSON-RPC method handlers.
