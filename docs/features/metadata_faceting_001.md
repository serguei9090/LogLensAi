# Feature Spec: Advanced Metadata Faceting (metadata_faceting_001)

## Overview
Implement a dynamic system to extract high-cardinality metadata (IPs, UUIDs, User IDs) from raw logs and display them as interactive "Facets" in the log analysis interface.

## Goals
1. **Extraction**: Enhance `metadata_extractor.py` to identify common patterns using regex.
2. **Storage**: Update the `logs` table or create a `metadata_facets` table to store extracted values.
3. **API**: Add a `get_metadata_facets` JSON-RPC method to the sidecar.
4. **UI**: Create a `FacetSidebar` component that lists top values and allows instant filtering.

## Technical Plan

### Backend (Python Sidecar)
- **Regex Library**: Add a collection of standard regex patterns for IPs, UUIDs, Email, and generic "Key=Value" pairs.
- **Database Schema**:
    - Ideally, a `log_facets` table: `(log_id, facet_key, facet_value)`.
    - Or store as a `metadata` JSON column in the `logs` table (DuckDB handles JSON well). I'll go with the JSON column for simplicity and flexibility.
- **Ingestion**: Update `ingest_logs` and `extract_log_metadata` to populate the `facets` JSON column.
- **Aggregation**: `method_get_metadata_facets` will perform a `GROUP BY` on the JSON keys to find top values.

### Frontend (React)
- **Store**: Update `investigationStore.ts` to hold active facet filters.
- **Components**:
    - `FacetSidebar`: Organism to display facets.
    - `FacetSection`: Molecule for a single key (e.g., "IP Address").
    - `FacetItem`: Atom for a value and count.
- **Filtering**: Integrate facet filters into the main `get_logs` RPC call.

## Success Criteria
- [ ] Logs show extracted IPs and UUIDs in a dedicated detail view.
- [ ] Sidebar displays "Top 10 IPs" with counts.
- [ ] Clicking a facet instantly filters the log table.
- [ ] Performance overhead during ingestion is < 10ms per 1000 lines.
