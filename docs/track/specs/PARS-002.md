# TODO(PARS-002): Dynamic Regex Parser Application

## Context
Custom parsing metadata is stored as JSON (`parser_config`) in the `fusion_configs` table. This JSON contains the regex patterns generated via the `CustomParserModal`'s "Highlight-to-Parse" workflow.

## Proposed Changes
1. **Parser Engine**: `sidecar/src/parser.py` must include a method `apply_custom_config(config_json, raw_line)`.
2. **Logic Specification**:
   - Parse `config_json` (e.g., matching groups for `timestamp`, `level`).
   - IF regex matches the `raw_line`:
     - Extract `timestamp`, `level`, and `metadata`.
     - IF no timestamp is found, fallback to the ingestion default (ISO current).
3. **Optimized Integration**: This logic must be callable during both mass ingest and live tail.

## Roles
- **@backend** (Logic Engine)

## Files
- `sidecar/src/parser.py`: Implementation of regex decoding and extraction logic.
- `sidecar/src/api.py`: Ingest path wiring.
