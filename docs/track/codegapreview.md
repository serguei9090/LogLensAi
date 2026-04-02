# Code Gap Review - LogLensAi (2026-03-31)

This audit identifies discrepancies between the intended architecture (AGENTS.md) and the current implementation state.

## 🔴 Critical Gaps (Functional/Architectural)

### 1. Broken Fusion Table Schema (PK DRIFT)
- **Location**: `sidecar/src/db.py`
- **Issue**: `fusion_id` was added via `ALTER TABLE`, but the composite Primary Key was not updated.
- **Impact**: The database only allows one entry per `(workspace_id, source_id)`, preventing multiple fusion configurations from existing simultaneously.
- **Remediation**: Implement a migration that re-creates the table with the triple-primary-key structure.

### 2. Missing Timezone Normalization (PARS-004)
- **Location**: `sidecar/src/api.py` (rejected humks)
- **Issue**: The `tz_offset` defined in `fusion_configs` is ignored in the fetcher.
- **Impact**: Fused logs from different server locations (e.g., UTC vs EST) appear interleaved incorrectly in the UI.
- **Remediation**: Apply timezone offsets to timestamps during the retrieval process in `method_get_fused_logs`.

### 3. AI Settings Sync Mismatch
- **Location**: `src/components/organisms/SettingsPanel.tsx` vs `sidecar/src/ai/__init__.py`
- **Issue**: Internal `AIProviderFactory` supports `ollama` and `ai-studio`, but UI displays `openai` and `anthropic` (unimplemented). UI is also missing `ollama`.
- **Impact**: Users cannot configure implemented local providers and might try to use unimplemented SaaS ones.
- **Remediation**: Sync `SettingsPanel.tsx` options with actual sidecar capabilities.

### 4. Residual Failed Patches (.rej files)
- **Location**: `sidecar/src/*.rej`
- **Issue**: Several critical patches for Fusion support were rejected during previous turns.
- **Impact**: Codebase is in an inconsistent state where models exist but logic is missing.
- **Remediation**: Manually apply all rejected hunks from `api.py.rej`, `db.py.rej`, `parser.py.rej`, and `tailer.py.rej`.

## 🟡 Improvement/Polish Gaps

### 1. DuckDB Performance
- **Issue**: Missing indexes on `workspace_id` for fast filtering.
- **Location**: `sidecar/src/db.py`
- **Remediation**: Add `CREATE INDEX` for workspace/fusion/source filtering columns.

### 2. A2A Error Propagation
- **Issue**: If A2A is down, we fallback to cold mode, but the user doesn't know it.
- **Location**: `sidecar/src/ai/gemini_cli.py`
- **Remediation**: Include a "Cold Fallback" metadata flag in the response so the UI can show a performance warning.
