# Feature Spec: Custom Facet Extraction (Regex)

## 1. Objective
Allow users to define custom regular expressions to extract structured metadata (facets) from raw logs. This enhances the analysis capabilities by enabling specialized extraction of business-specific fields (e.g., `transaction_id`, `order_num`, `trace_id`) that are not covered by the generic heuristics.

## 2. Requirements
- **Dynamic Rules**: Users must be able to add/remove extraction rules via the UI.
- **Hierarchical Settings**: Support for Global rules (applies to all logs) and Workspace-specific rules (applies only to logs in that workspace).
- **Rule Structure**: 
    - `name`: The key stored in the `facets` JSON (e.g., `tx_id`).
    - `pattern`: The regex pattern to match.
    - `group`: (Optional) The capture group to extract (default to 0 or 1 if grouping exists).
- **Zero-Downtime**: Extraction rules must apply to new logs immediately after saving.

## 3. Architecture
### Backend changes:
- **`sidecar/src/api.py`**: Update `get_settings` and `update_settings` to handle `facet_extractions`.
- **`sidecar/src/metadata_extractor.py`**: Refactor `extract_log_metadata` to load rules from settings and apply them after the generic heuristics.
### Frontend changes:
- **`src/store/settingsStore.ts`**: Add `facet_extractions` state and synchronization.
- **`src/components/organisms/SettingsPanel.tsx`**: Add "Custom Facet Extraction" management UI.
- **`src/components/organisms/WorkspaceEngineSettings.tsx`**: Add workspace-specific facet management.

## 4. Work Plan
1. **Define Schema**: Create a Pydantic model for `FacetExtractionRule`.
2. **Backend Logic**: Update `metadata_extractor.py` to support dynamic rules.
3. **Store Logic**: Update `settingsStore.ts` to handle the new configuration array.
4. **UI Scaffolding**: Build the Rule management component in the Settings panel.
5. **Validation**: Test with a sample regex to ensure a field appears in the `facets` column.
