# TODO(ingestion_001): Configurable Ingestion Listeners

## Description
Ensure that LogLensAi ingestion listeners (HTTP and Syslog) are manageable via the UI settings. This prevents port conflicts in multi-instance dev environments and allows users to customize their ingestion strategy.

## Requirements
1. **Sidecar**:
   - `App.update_settings` must check for ingestion changes.
   - If `ingestion_syslog_enabled` changes, start/stop the thread.
   - If `ingestion_syslog_port` changes, restart the thread.
   - Same for HTTP.
2. **Routing**:
   - HTTP listener should support a parameter (e.g., `?ws=...`) to route logs to a specific workspace.
   - Default to "default" workspace if not provided.
3. **Frontend**:
   - Add "Ingestion" card to `SettingsPanel`.
   - Fields: 
     - Syslog: Toggle + Port input.
     - HTTP: Toggle + Port input.

## Implementation Details
- `sidecar/src/api.py`: 
  - Update `method_update_settings` to trigger `self.ingestion_server.reconfigure(new_settings)`.
- `sidecar/src/ingestion.py`:
  - Refactor `start()` and `stop()` to be more robust.
  - Add `reconfigure()` method.
