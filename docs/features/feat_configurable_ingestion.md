# Feature: Configurable Log Ingestion

## Overview
LogLensAi needs a robust way to ingest logs from external streams (Syslog and HTTP webhooks). Currently, these listeners are hardcoded and non-configurable. This feature introduces a settings-driven lifecycle for ingestion listeners, allowing users to enable/disable them, change ports, and route logs to specific workspaces.

## User Flow
1. **Settings Configuration**:
   - User goes to **Settings > Ingestion**.
   - Toggles "Enable Syslog Listener" and/or "Enable HTTP Ingestion".
   - Changes the Ports (e.g., from 514 to 1514).
   - Sidecar re-binds listeners immediately.
2. **Import Modal (Advanced)**:
   - When adding a new source, user can select "Live Stream (Listener)".
   - Selects which workspace/source name this listener should represent.

## Technical Architecture

### 1. Persistence (Sidecar)
- Updated `settings` table in DuckDB to include:
  - `ingestion_syslog_enabled` (bool)
  - `ingestion_syslog_port` (int)
  - `ingestion_http_enabled` (bool)
  - `ingestion_http_port` (int)

### 2. Sidecar Logic (`IngestionServer`)
- Add a `reconfigure(settings)` method.
- Catch bind errors (port in use) and report via `get_health`.
- HTTP Ingestion: Support `?workspace_id=...&source_id=...` query params to override defaults.

### 3. Frontend (React)
- **Settings Page**: New "Listeners" section with toggles and port inputs.
- **Store**: `settingsStore.ts` to track these states.

## Identification Strategy
- **Syslog**: Identified by `syslog://<source_ip>`.
- **HTTP**:
  - Global endpoint: `/ingest`
  - Workspace-specific endpoint: `/ingest/<workspace_id>`
  - Identification via `X-Source-ID` header or query param.

## Tasks
- [ ] **FE-001**: Update `settingsStore.ts` with ingestion fields.
- [ ] **FE-002**: UI — Create Ingestion settings panel.
- [ ] **BE-001**: Sidecar — Implement dynamic restart for `IngestionServer`.
- [ ] **BE-002**: Sidecar — Add workspace-aware routing in `ingestion.py`.
- [ ] **INT-001**: Connect UI toggles to sidecar reconfigure RPC.
