# FIX-HIER-001: Hierarchy Cascade Deletion Bug

**Status:** Resolved
**Target:** Database `delete_folder` Method
**Priority:** P0 (Critical Data Integrity)

## Context
During the execution of `test_hierarchy.py::test_folder_crud`, the test failed with `assert 0 == 1` when verifying the folder children count after deletion.

## Root Cause
When a parent folder (`f1`) was deleted, its child folders (e.g., `f2`) and child log sources were being cascade-deleted or orphaned instead of promoted. The previous logic performed a destructive recursive delete or didn't handle re-parenting.

## Remediation
The `delete_folder` method in `sidecar/src/db.py` was refactored to properly handle folder deletion.
Before deleting the specified folder, the code now executes update queries to set `parent_id = NULL` for any child folders and child sources. This "promotes" the children to the workspace root, preserving the user's data structure and preventing accidental data loss.

```python
# Re-parent child folders to root (NULL)
self.cursor.execute(
    "UPDATE folders SET parent_id = NULL WHERE workspace_id = ? AND parent_id = ?",
    (workspace_id, folder_id)
)

# Re-parent child sources to root (NULL)
self.cursor.execute(
    "UPDATE log_sources SET folder_id = NULL WHERE workspace_id = ? AND folder_id = ?",
    (workspace_id, folder_id)
)

# Delete the target folder
self.cursor.execute(
    "DELETE FROM folders WHERE workspace_id = ? AND id = ?",
    (workspace_id, folder_id)
)
```

## Outcome
The test suite `test_hierarchy.py` now passes completely. The database hierarchy management is resilient against data loss when reorganizing workspaces.
