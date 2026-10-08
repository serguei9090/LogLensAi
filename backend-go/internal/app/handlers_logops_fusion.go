package app

import (
	"database/sql"
	"strings"
	"time"

	"loglensai/backend-go/internal/models"
)

// UpdateSourceParser implements the update_source_parser RPC method,
// mirroring api.py's App.method_update_source_parser -- including that it
// updates every fusion_configs row for (workspace_id, source_id) regardless
// of fusion_id (Python's UPDATE has no fusion_id predicate either).
func (a *App) UpdateSourceParser(req models.UpdateSourceParserRequest) (any, *models.RPCError) {
	if _, err := a.DB.Conn.Exec(`UPDATE fusion_configs SET parser_config = ? WHERE workspace_id = ? AND source_id = ?`,
		req.ParserConfig, req.WorkspaceID, req.SourceID); err != nil {
		return nil, &models.RPCError{Code: errInternal, Message: err.Error()}
	}
	return map[string]any{"status": "ok"}, nil
}

// defaultFusionID compensates for a documented, pre-existing gap in this
// migration (see internal/models/shared.go's package doc comment): Go has
// no pydantic-style default-substitution at the transport layer, so a
// request that omits fusion_id decodes to "" rather than Python's "default".
func defaultFusionID(id string) string {
	if id == "" {
		return "default"
	}
	return id
}

// GetFusionConfig implements the get_fusion_config RPC method, mirroring
// api.py's App.method_get_fusion_config.
func (a *App) GetFusionConfig(req models.GetFusionConfigRequest) (any, *models.RPCError) {
	fusionID := defaultFusionID(req.FusionID)

	rows, err := a.DB.Conn.Query(
		`SELECT source_id, enabled, tz_offset, custom_format, parser_config FROM fusion_configs WHERE workspace_id = ? AND fusion_id = ?`,
		req.WorkspaceID, fusionID,
	)
	if err != nil {
		return nil, &models.RPCError{Code: errInternal, Message: err.Error()}
	}
	defer rows.Close()

	sources := []map[string]any{}
	for rows.Next() {
		var sourceID string
		var enabled bool
		var tzOffset int64
		var customFormat, parserConfig sql.NullString
		if err := rows.Scan(&sourceID, &enabled, &tzOffset, &customFormat, &parserConfig); err != nil {
			continue
		}
		m := map[string]any{"source_id": sourceID, "enabled": enabled, "tz_offset": tzOffset}
		if customFormat.Valid {
			m["custom_format"] = customFormat.String
		} else {
			m["custom_format"] = nil
		}
		if parserConfig.Valid {
			m["parser_config"] = parserConfig.String
		} else {
			m["parser_config"] = nil
		}
		sources = append(sources, m)
	}

	return map[string]any{"sources": sources}, nil
}

// UpdateFusionConfig implements the update_fusion_config RPC method,
// mirroring api.py's App.method_update_fusion_config: one upsert per source
// entry.
func (a *App) UpdateFusionConfig(req models.UpdateFusionConfigRequest) (any, *models.RPCError) {
	fusionID := defaultFusionID(req.FusionID)

	for _, src := range req.Sources {
		if _, err := a.DB.Conn.Exec(`
			INSERT INTO fusion_configs (workspace_id, fusion_id, source_id, enabled, tz_offset, custom_format, parser_config)
			VALUES (?, ?, ?, ?, ?, ?, ?)
			ON CONFLICT (workspace_id, fusion_id, source_id) DO UPDATE SET
				enabled = excluded.enabled,
				tz_offset = excluded.tz_offset,
				custom_format = excluded.custom_format,
				parser_config = excluded.parser_config
		`, req.WorkspaceID, fusionID, src.SourceID, src.Enabled, src.TzOffset, src.CustomFormat, src.ParserConfig); err != nil {
			return nil, &models.RPCError{Code: errInternal, Message: err.Error()}
		}
	}

	return map[string]any{"status": "ok"}, nil
}

// GetFusedLogs implements the get_fused_logs RPC method, mirroring api.py's
// App.method_get_fused_logs.
func (a *App) GetFusedLogs(req models.GetFusedLogsRequest) (any, *models.RPCError) {
	fusionID := defaultFusionID(req.FusionID)

	rows, err := a.DB.Conn.Query(
		`SELECT source_id, tz_offset FROM fusion_configs WHERE workspace_id = ? AND fusion_id = ? AND enabled = TRUE`,
		req.WorkspaceID, fusionID,
	)
	if err != nil {
		return nil, &models.RPCError{Code: errInternal, Message: err.Error()}
	}
	enabledIDs := []string{}
	tzOffsets := map[string]int64{}
	for rows.Next() {
		var id string
		var tz int64
		if rows.Scan(&id, &tz) == nil {
			enabledIDs = append(enabledIDs, id)
			tzOffsets[id] = tz
		}
	}
	rows.Close()

	result := a.getLogsInternal(req.WorkspaceID, req.Offset, req.Limit, req.Filters, req.Query, req.SortBy, req.SortOrder, enabledIDs, req.StartTime, req.EndTime)

	if logs, ok := result["logs"].([]map[string]any); ok {
		for _, logRow := range logs {
			srcID, _ := logRow["source_id"].(string)
			offset := tzOffsets[srcID]
			if offset == 0 {
				continue
			}
			ts, _ := logRow["timestamp"].(string)
			if ts == "" {
				continue
			}
			if shifted, ok := shiftFusionTimestamp(ts, offset); ok {
				logRow["timestamp"] = shifted
			}
		}
	}

	return result, nil
}

// shiftFusionTimestamp adds offsetHours hours to a "YYYY-MM-DD
// HH:MM:SS[...]" timestamp.
func shiftFusionTimestamp(ts string, offsetHours int64) (string, bool) {
	tsStr := strings.ReplaceAll(ts, "T", " ")
	if len(tsStr) < 19 {
		return "", false
	}
	t, err := time.Parse("2006-01-02 15:04:05", tsStr[:19])
	if err != nil {
		return "", false
	}
	t = t.Add(time.Duration(offsetHours) * time.Hour)
	return t.Format("2006-01-02 15:04:05"), true
}
