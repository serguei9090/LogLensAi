# TODOC: FACET-001 - Custom Regex Facet Extraction

## Status
- [ ] Backend: Update settings schema to include `facet_extractions`
- [ ] Backend: Refactor `metadata_extractor.py` to use dynamic rules
- [ ] Frontend: Update `settingsStore.ts`
- [ ] Frontend: Build "Custom Facet Extraction" UI in SettingsPanel (Global)
- [ ] Frontend: Build "Workspace Facet Extraction" UI in WorkspaceEngineSettings

## Technical Details

### Settings Payload
```json
{
  "facet_extractions": [
    {
      "name": "transaction_id",
      "regex": "tx_([a-zA-Z0-9]+)",
      "group": 1,
      "enabled": true
    }
  ]
}
```

### Backend Logic (`metadata_extractor.py`)
1. Load global settings.
2. Load workspace settings.
3. Merge rules.
4. For each enabled rule:
   - `re.search(rule.regex, log_line)`
   - Extract `group` or `groupdict`
   - Store in `facets[rule.name]`

### UI Design
- A table/list of rules.
- "Add Rule" button opening a small form.
- "Test" button (optional but good for UX) to check against sample text.
