package app

import (
	"database/sql"
	"encoding/json"
	"fmt"
	"log"
	"math"
	"os"
	"strconv"
	"strings"

	"loglensai/backend-go/internal/drain3"
	"loglensai/backend-go/internal/models"
)

// This file implements the settings/templates/log-streams/temporal-offsets
// RPC handlers, mirroring the corresponding method_* functions in
// sidecar/src/api.py: method_get_settings, method_update_settings,
// method_reset_workspace_settings, method_save_template,
// method_get_templates, method_delete_template, method_reset_templates,
// method_get_log_streams, method_create_log_stream,
// method_delete_log_stream, method_update_temporal_offsets,
// method_get_temporal_offsets.
//
// Scope note: Python's method_update_settings also (a) re-initializes the AI
// provider/HybridRunner when ai_* keys change and (b) reconfigures the
// ingestion server's syslog/HTTP listeners when ingestion_* keys change (see
// api.py's _check_ai_provider_reload and the inline ingestion_server.reconfigure
// call). Neither subsystem is wired into *App yet as of this pass (AI
// provider construction lives in internal/rpc's RegisterAI wiring, outside
// this package's reach without a dependency cycle; there is no
// ingestion-server field on App at all -- see app.go). Both side effects are
// intentionally omitted here; only the drain_* miner-cache invalidation
// (which *is* fully within this package's reach) is reproduced.

// --- get_settings / update_settings / reset_workspace_settings ---

// GetSettings implements the get_settings RPC method, mirroring api.py's
// App.method_get_settings: merged global + (if a workspace_id is given)
// workspace-override settings, workspace values winning on key collision.
func (a *App) GetSettings(req models.GetSettingsRequest) (any, *models.RPCError) {
	workspaceID := ""
	if req.WorkspaceID != nil {
		workspaceID = *req.WorkspaceID
	}
	return a.getSettings(workspaceID), nil
}

// UpdateSettings implements the update_settings RPC method, mirroring
// api.py's App.method_update_settings: upserts into `settings` (global) or
// `workspace_settings` (if workspace_id is given), then busts the cached
// Drain3 miner(s) if any drain_* key changed (mirroring the parser-cache
// invalidation block; the AI-provider-reload and ingestion-server-reconfigure
// side effects are out of scope here, see this file's package-level doc
// comment).
func (a *App) UpdateSettings(req models.UpdateSettingsRequest) (any, *models.RPCError) {
	workspaceID := ""
	if req.WorkspaceID != nil {
		workspaceID = *req.WorkspaceID
	}

	if err := a.persistSettings(req.Settings, workspaceID); err != nil {
		return nil, &models.RPCError{Code: errInternal, Message: err.Error()}
	}

	if anyKeyHasPrefix(req.Settings, "drain_") {
		a.minersMu.Lock()
		if workspaceID != "" {
			delete(a.miners, workspaceID)
		} else {
			a.miners = make(map[string]*drain3.Miner)
		}
		a.minersMu.Unlock()
	}

	return map[string]any{"status": "success"}, nil
}

// ResetWorkspaceSettings implements the reset_workspace_settings RPC method,
// mirroring api.py's App.method_reset_workspace_settings: deletes every
// workspace_settings row for workspace_id (falling back to global defaults)
// and invalidates that workspace's cached Drain3 miner.
func (a *App) ResetWorkspaceSettings(req models.GetSettingsRequest) (any, *models.RPCError) {
	if req.WorkspaceID == nil || *req.WorkspaceID == "" {
		return map[string]any{"status": "error", "message": "workspace_id required"}, nil
	}
	workspaceID := *req.WorkspaceID

	if _, err := a.DB.Conn.Exec(`DELETE FROM workspace_settings WHERE workspace_id = ?`, workspaceID); err != nil {
		return nil, &models.RPCError{Code: errInternal, Message: err.Error()}
	}

	a.minersMu.Lock()
	delete(a.miners, workspaceID)
	a.minersMu.Unlock()

	return map[string]any{"status": "ok"}, nil
}

// persistSettings upserts every (key, value) pair in settings into either
// `workspace_settings` (workspaceID != "") or the global `settings` table,
// mirroring api.py's App._persist_settings.
func (a *App) persistSettings(settings map[string]any, workspaceID string) error {
	for k, v := range settings {
		val := stringifySettingValue(v)
		var err error
		if workspaceID != "" {
			_, err = a.DB.Conn.Exec(
				`INSERT INTO workspace_settings (workspace_id, key, value) VALUES (?, ?, ?)
				 ON CONFLICT (workspace_id, key) DO UPDATE SET value = excluded.value`,
				workspaceID, k, val,
			)
		} else {
			_, err = a.DB.Conn.Exec(
				`INSERT INTO settings (key, value) VALUES (?, ?)
				 ON CONFLICT (key) DO UPDATE SET value = excluded.value`,
				k, val,
			)
		}
		if err != nil {
			return fmt.Errorf("app: persisting setting %q: %w", k, err)
		}
	}
	return nil
}

// stringifySettingValue mirrors api.py's
// `json.dumps(v) if isinstance(v, (list, dict)) else str(v)` value coercion
// for the TEXT-typed settings.value column. Go's encoding/json decodes every
// JSON number into float64 regardless of whether the original literal was an
// int or a float, so whole numbers are rendered without a decimal point
// (matching Python's str(5) == "5") while fractional numbers keep Go's
// shortest round-trippable decimal representation -- this can differ from
// Python's repr in rare edge cases (e.g. very large/precise floats), a minor
// documented deviation rather than exact byte-for-byte parity. Booleans are
// rendered capitalized ("True"/"False") to match Python's str(bool) exactly,
// since call sites elsewhere (e.g. api.py's ingestion_* flag parsing) compare
// against lowercased values and would tolerate either, but other callers may
// display the raw setting value verbatim.
func stringifySettingValue(v any) string {
	switch t := v.(type) {
	case nil:
		return "None"
	case string:
		return t
	case bool:
		if t {
			return "True"
		}
		return "False"
	case float64:
		if !math.IsInf(t, 0) && !math.IsNaN(t) && t == math.Trunc(t) {
			return strconv.FormatInt(int64(t), 10)
		}
		return strconv.FormatFloat(t, 'f', -1, 64)
	case []any, map[string]any:
		b, err := json.Marshal(t)
		if err != nil {
			return fmt.Sprintf("%v", t)
		}
		return string(b)
	default:
		return fmt.Sprintf("%v", t)
	}
}

func anyKeyHasPrefix(m map[string]any, prefix string) bool {
	for k := range m {
		if strings.HasPrefix(k, prefix) {
			return true
		}
	}
	return false
}

// --- save_template / get_templates / delete_template / reset_templates ---

// SaveTemplate implements the save_template RPC method, mirroring api.py's
// App.method_save_template: persists a discovery template (filters +
// highlights) as one settings_templates row.
func (a *App) SaveTemplate(workspaceID, name, configJSON string) (any, *models.RPCError) {
	if _, err := a.DB.Conn.Exec(
		`INSERT INTO settings_templates (workspace_id, name, config_json) VALUES (?, ?, ?)`,
		workspaceID, name, configJSON,
	); err != nil {
		return nil, &models.RPCError{Code: errInternal, Message: err.Error()}
	}
	return map[string]any{"status": "ok"}, nil
}

// GetTemplates implements the get_templates RPC method, mirroring api.py's
// App.method_get_templates. created_at is read back via CAST(... AS VARCHAR)
// so DuckDB itself renders the timestamp string (same
// "YYYY-MM-DD HH:MM:SS[.ffffff]" shape Python gets from str(datetime)),
// rather than round-tripping through a Go time.Time and reformatting it.
func (a *App) GetTemplates(workspaceID string) (any, *models.RPCError) {
	rows, err := a.DB.Conn.Query(
		`SELECT id, name, config_json, CAST(created_at AS VARCHAR) FROM settings_templates WHERE workspace_id = ? ORDER BY created_at DESC`,
		workspaceID,
	)
	if err != nil {
		return nil, &models.RPCError{Code: errInternal, Message: err.Error()}
	}
	defer rows.Close()

	templates := []map[string]any{}
	for rows.Next() {
		var id int64
		var name, config, createdAt string
		if scanErr := rows.Scan(&id, &name, &config, &createdAt); scanErr != nil {
			continue
		}
		templates = append(templates, map[string]any{
			"id": id, "name": name, "config": config, "created_at": createdAt,
		})
	}
	return templates, nil
}

// DeleteTemplate implements the delete_template RPC method, mirroring
// api.py's App.method_delete_template.
func (a *App) DeleteTemplate(id int) (any, *models.RPCError) {
	if _, err := a.DB.Conn.Exec(`DELETE FROM settings_templates WHERE id = ?`, id); err != nil {
		return nil, &models.RPCError{Code: errInternal, Message: err.Error()}
	}
	return map[string]any{"status": "ok"}, nil
}

// ResetTemplates implements the reset_templates RPC method, mirroring
// api.py's App.method_reset_templates. Despite the "templates" name, this
// resets Drain3's *log-clustering* templates (the miner's learned tree +
// on-disk persistence state), not the unrelated settings_templates table --
// api.py's own implementation is the same: it never touches
// settings_templates, it deletes the drain persistence file for the
// resolved (global-or-per-workspace) scope and drops the matching cached
// parser. Reuses the same scope-resolution and state-file-path logic
// GetDrainParser/drainStatePath already implement (see app.go) so this stays
// consistent with how a parser is (re)created on next use.
func (a *App) ResetTemplates(workspaceID string) (any, *models.RPCError) {
	settings := a.getSettings("")
	scope := settings["drain_template_scope"]
	if scope == "" {
		scope = "global"
	}

	key := drainGlobalKey
	if scope != "global" && workspaceID != "" {
		key = workspaceID
	}

	a.minersMu.Lock()
	delete(a.miners, key)
	a.minersMu.Unlock()

	path := a.drainStatePath(key)
	if err := os.Remove(path); err != nil && !os.IsNotExist(err) {
		log.Printf("[App] Failed to remove drain state file %s: %v", path, err)
	}

	return map[string]any{"status": "success", "scope": scope, "workspace_id": workspaceID}, nil
}

// --- get_log_streams / create_log_stream / delete_log_stream ---

// GetLogStreams implements the get_log_streams RPC method, mirroring
// api.py's App.method_get_log_streams.
func (a *App) GetLogStreams(req models.GetLogStreamsRequest) (any, *models.RPCError) {
	rows, err := a.DB.Conn.Query(
		`SELECT id, workspace_id, name, type, port, enabled FROM log_streams WHERE workspace_id = ?`,
		req.WorkspaceID,
	)
	if err != nil {
		return nil, &models.RPCError{Code: errInternal, Message: err.Error()}
	}
	defer rows.Close()

	streams := []map[string]any{}
	for rows.Next() {
		var id int64
		var workspaceID, name, typ string
		var port sql.NullInt64
		var enabled bool
		if scanErr := rows.Scan(&id, &workspaceID, &name, &typ, &port, &enabled); scanErr != nil {
			continue
		}
		var portVal any
		if port.Valid {
			portVal = port.Int64
		}
		streams = append(streams, map[string]any{
			"id": id, "workspace_id": workspaceID, "name": name, "type": typ, "port": portVal, "enabled": enabled,
		})
	}
	return streams, nil
}

// CreateLogStream implements the create_log_stream RPC method, mirroring
// api.py's App.method_create_log_stream. Python also calls
// self.ingestion_server.refresh_streams() after the insert; *App has no
// ingestion-server subsystem wired yet (see this file's package-level doc
// comment), so there is nothing to refresh here.
func (a *App) CreateLogStream(req models.CreateLogStreamRequest) (any, *models.RPCError) {
	if _, err := a.DB.Conn.Exec(
		`INSERT INTO log_streams (workspace_id, name, type, port) VALUES (?, ?, ?, ?)`,
		req.WorkspaceID, req.Name, req.Type, req.Port,
	); err != nil {
		return nil, &models.RPCError{Code: errInternal, Message: err.Error()}
	}
	return map[string]any{"status": "success"}, nil
}

// DeleteLogStream implements the delete_log_stream RPC method, mirroring
// api.py's App.method_delete_log_stream (see CreateLogStream's doc comment
// re: the omitted ingestion_server.refresh_streams() call).
func (a *App) DeleteLogStream(req models.DeleteLogStreamRequest) (any, *models.RPCError) {
	if _, err := a.DB.Conn.Exec(`DELETE FROM log_streams WHERE id = ?`, req.ID); err != nil {
		return nil, &models.RPCError{Code: errInternal, Message: err.Error()}
	}
	return map[string]any{"status": "success"}, nil
}

// --- update_temporal_offsets / get_temporal_offsets ---

// UpdateTemporalOffsets implements the update_temporal_offsets RPC method,
// mirroring api.py's App.method_update_temporal_offsets: upserts one
// temporal_offsets row per (source_id, offset_seconds) pair.
func (a *App) UpdateTemporalOffsets(req models.UpdateTemporalOffsetsRequest) (any, *models.RPCError) {
	for sourceID, offsetSeconds := range req.Offsets {
		if _, err := a.DB.Conn.Exec(
			`INSERT INTO temporal_offsets (workspace_id, source_id, offset_seconds) VALUES (?, ?, ?)
			 ON CONFLICT (workspace_id, source_id) DO UPDATE SET offset_seconds = excluded.offset_seconds`,
			req.WorkspaceID, sourceID, offsetSeconds,
		); err != nil {
			return nil, &models.RPCError{Code: errInternal, Message: err.Error()}
		}
	}
	return map[string]any{"status": "ok"}, nil
}

// GetTemporalOffsets implements the get_temporal_offsets RPC method,
// mirroring api.py's App.method_get_temporal_offsets.
func (a *App) GetTemporalOffsets(req models.GetTemporalOffsetsRequest) (any, *models.RPCError) {
	rows, err := a.DB.Conn.Query(
		`SELECT source_id, offset_seconds FROM temporal_offsets WHERE workspace_id = ?`,
		req.WorkspaceID,
	)
	if err != nil {
		return nil, &models.RPCError{Code: errInternal, Message: err.Error()}
	}
	defer rows.Close()

	offsets := map[string]int64{}
	for rows.Next() {
		var sourceID string
		var offset int64
		if scanErr := rows.Scan(&sourceID, &offset); scanErr != nil {
			continue
		}
		offsets[sourceID] = offset
	}
	return map[string]any{"offsets": offsets}, nil
}
