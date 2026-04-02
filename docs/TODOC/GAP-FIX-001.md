# GAP-FIX-001: Fusion Configs PK Migration

## 🎯 Objective
Migrate `fusion_configs` from its legacy dual-key PK `(workspace_id, source_id)` to a multi-fusion PK `(workspace_id, fusion_id, source_id)`.

## 🏗️ Execution Plan
1.  **Backup Data**: Create a temp table `fusion_configs_backup`.
2.  **Drop & Recreate**: Drop `fusion_configs` and recreate with correct PK and `fusion_id` default.
3.  **Restore Data**: Insert from backup with `fusion_id = 'default'`.
4.  **Verification**: Confirm multiple configurations for the same log source can coexist in different fusion IDs.

## ✅ Constraints
- Must handle the case where `fusion_id` column already exists but PK is wrong.
- Must preserve `parser_config` and `tz_offset`.
