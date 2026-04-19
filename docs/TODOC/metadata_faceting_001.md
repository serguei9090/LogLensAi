# Task Memory: metadata_faceting_001

## Status
- [ ] Backend: Schema migration (add `facets` JSON column to `logs`).
- [ ] Backend: Update `metadata_extractor.py` with expanded patterns.
- [ ] Backend: Update `ingest_logs` flow.
- [ ] Backend: Implement `method_get_metadata_facets`.
- [ ] Frontend: Store integration (`facetFilters`).
- [ ] Frontend: UI implementation (`FacetSidebar`).

## Architectural Decisions
- **Storage**: Using DuckDB's `JSON` type for the `facets` column. This avoids complex join logic and allows for arbitrary key-value pairs without schema migrations for every new pattern detected.
- **Extraction**: Only extract during ingestion to keep read performance high.
- **Aggregation**: Top-N aggregation will be done via DuckDB's `json_extract_path` and `GROUP BY`.

## References
- `sidecar/src/metadata_extractor.py`
- `sidecar/src/api.py`
- `src/store/investigationStore.ts`
