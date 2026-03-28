# TODOC: ANALYSIS-005 - Source-Specific Templates

## Overview
Allow users to persist complex investigative logic (filters + highlights) as named templates and apply them dynamically to specific log sources within a workspace.

## Interface Specifications
1. **Save Workflow**:
    - **Icon**: Located to the right of the "Highlight" button in the `LogToolbar`.
    - **Modal**: Opens "Save Discovery Template" modal. Displays a summary of current Filters and Highlights. Requires a Name.
2. **Apply Workflow**:
    - **Location**: Orchestrator Hub.
    - **Control**: Each enabled log source has a "Template" dropdown.
    - **Action**: Selecting a template applies its specific rules *only* to the logs originating from that source ID.

## Data Persistence
- **Table**: `settings_templates` (id, name, config_json, created_at).
- `config_json` stores an array of filter and highlight objects compatible with the `investigationStore`.

## Rationale
Since log files vary in format (filenames, column order), applying a global template to a whole workspace often leads to false negatives. Source-specific application restores precision.
