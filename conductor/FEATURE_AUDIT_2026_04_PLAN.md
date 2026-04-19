# Feature Implementation Plan: FEATURE_AUDIT_2026_04

## Background & Motivation
The LogLensAi feature audit identified 5 high-impact features needed to elevate the platform to a "Professional" tier. These include advanced metadata faceting, LogLens Query Language (LLQL), Syslog & HTTP ingestion, a Smart Context Manager for AI tokens, and time-series anomaly detection. 

## Scope & Impact
The scope spans across the Python backend sidecar (FastAPI, DuckDB) and the React frontend. Impacted files include `sidecar/src/metadata_extractor.py`, `sidecar/src/db.py`, `sidecar/src/api.py`, `sidecar/src/ai/context.py`, and `src/components/organisms/LogDistributionWidget.tsx`.

## Proposed Solution
We will dispatch the `@commander` agent to implement each feature sequentially. Sequential execution avoids schema and source file merge conflicts in critical shared components such as `sidecar/src/db.py` and `sidecar/src/api.py`. Specific implementation details will be derived from the corresponding specification documents in the `docs/TODOC/` directory (e.g. `metadata_faceting_001.md`).

## Alternatives Considered
- **Parallel Subagent Dispatch:** Dismissed due to the high risk of DuckDB schema and `api.py` merge conflicts.

## Implementation Plan (Phased)

### Phase 1: Advanced Metadata Faceting
1. `@commander` will update `sidecar/src/metadata_extractor.py` to extract IPs, UUIDs, and Emails via regex.
2. Update `sidecar/src/db.py` to persist these facets in DuckDB.
3. Build the `FacetList` molecule in the frontend sidebar.

### Phase 2: LogLens Query Language (LLQL)
1. `@commander` will implement `sidecar/src/query_parser.py` to translate Lucene syntax to DuckDB `WHERE` clauses.
2. Integrate parser with `LogDatabase.query_logs`.

### Phase 3: Syslog & HTTP Ingestion "Ports"
1. `@commander` will add an `IngestionServer` listener in `sidecar/src/api.py` for UDP 514 and TCP 5001.
2. Feed the live log stream to `DrainParser` and DuckDB.

### Phase 4: Smart Context Manager
1. `@commander` will create `sidecar/src/ai/context.py`.
2. Implement mundane log filtering and repeated log summarization to optimize the LLM context window.

### Phase 5: Time-Series Anomaly Detection
1. `@commander` will add a background job to calculate Z-scores for cluster frequencies.
2. Store 'anomaly' flags and update `LogDistributionWidget.tsx` to visualize volume spikes.

## Verification
- Unit tests will be created/updated for the LLQL parser and the metadata extractor.
- Frontend `vitest` and backend `pytest` suites must pass locally.
- E2E verification of Syslog/HTTP ingestion by sending test UDP packets to the listener.

## Migration & Rollback
- DuckDB schema changes will be appended. If tests fail during a phase, the commit for that phase will be rolled back.
- A clean start cycle (`recreate_sidecar.sh`) can be used to reset the database and validate data ingestion during local development.