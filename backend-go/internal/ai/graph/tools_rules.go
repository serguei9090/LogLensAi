package graph

import (
	"context"
	"database/sql"
	"encoding/json"
	"fmt"
	"strings"
)

// --- search_memory ---

type searchMemoryParams struct {
	WorkspaceID string `json:"workspace_id"`
	Query       string `json:"query"`
}

func (r *ToolRegistry) searchMemory(ctx context.Context, args json.RawMessage) (any, error) {
	var p searchMemoryParams
	if err := json.Unmarshal(args, &p); err != nil {
		return []map[string]any{{"error": err.Error()}}, nil
	}

	if r.memory == nil {
		return []map[string]any{{"error": "memory search is not configured"}}, nil
	}

	results, err := r.memory.SearchMemory(ctx, p.WorkspaceID, p.Query, 5)
	if err != nil {
		return []map[string]any{{"error": err.Error()}}, nil
	}
	return results, nil
}

// --- create_column ---

type createColumnParams struct {
	Label  string  `json:"label"`
	Source string  `json:"source"`
	Regex  *string `json:"regex"`
	Width  string  `json:"width"`
}

func (r *ToolRegistry) createColumn(_ context.Context, args json.RawMessage) (any, error) {
	var p createColumnParams
	p.Width = "120px"
	if err := json.Unmarshal(args, &p); err != nil {
		return map[string]any{"error": err.Error()}, nil
	}

	regexJSON := "null"
	if p.Regex != nil {
		if b, err := json.Marshal(*p.Regex); err == nil {
			regexJSON = string(b)
		}
	}

	a2ui := fmt.Sprintf(
		`[[A2UI]]{"type": "add_column", "label": %s, "source": %s, "regex": %s, "width": %s}[[/A2UI]]`,
		mustJSONString(p.Label), mustJSONString(p.Source), regexJSON, mustJSONString(p.Width),
	)

	return map[string]any{
		"status":     "success",
		"message":    "Column request registered. You MUST output the matching A2UI block in your final answer text.",
		"a2ui_block": a2ui,
	}, nil
}

func mustJSONString(s string) string {
	b, err := json.Marshal(s)
	if err != nil {
		return `""`
	}
	return string(b)
}

// --- create_facet ---

type createFacetParams struct {
	WorkspaceID string `json:"workspace_id"`
	Pattern     string `json:"pattern"`
	Label       string `json:"label"`
	Enabled     *bool  `json:"enabled"`
}

type maskRule struct {
	Pattern string `json:"pattern"`
	Label   string `json:"label"`
	Enabled bool   `json:"enabled"`
}

func (r *ToolRegistry) createFacet(_ context.Context, args json.RawMessage) (any, error) {
	var p createFacetParams
	enabled := true
	p.Enabled = &enabled
	if err := json.Unmarshal(args, &p); err != nil {
		return map[string]any{"status": "error", "error": err.Error()}, nil
	}

	conn := r.app.DB.Conn

	masksRaw := r.readDrainMasksSetting(p.WorkspaceID)
	var masks []maskRule
	if masksRaw != "" {
		if unmarshalErr := json.Unmarshal([]byte(masksRaw), &masks); unmarshalErr != nil {
			var inner string
			if json.Unmarshal([]byte(masksRaw), &inner) == nil {
				_ = json.Unmarshal([]byte(inner), &masks)
			}
		}
	}

	exists := false
	for i := range masks {
		if masks[i].Label == p.Label && masks[i].Pattern == p.Pattern {
			masks[i].Enabled = *p.Enabled
			exists = true
			break
		}
	}
	if !exists {
		masks = append(masks, maskRule{Pattern: p.Pattern, Label: p.Label, Enabled: *p.Enabled})
	}

	newRaw, err := json.Marshal(masks)
	if err != nil {
		return map[string]any{"status": "error", "error": err.Error()}, nil
	}

	if writeErr := r.writeDrainMasksSetting(conn, p.WorkspaceID, string(newRaw)); writeErr != nil {
		return map[string]any{"status": "error", "error": writeErr.Error()}, nil
	}

	return map[string]any{
		"status":    "success",
		"message":   fmt.Sprintf("Successfully created/updated facet '%s' with pattern '%s'.", p.Label, p.Pattern),
		"facet_key": strings.ToLower(p.Label),
	}, nil
}

func (r *ToolRegistry) readDrainMasksSetting(workspaceID string) string {
	conn := r.app.DB.Conn

	var value string
	_ = conn.QueryRow(`SELECT value FROM settings WHERE key = 'drain_masks'`).Scan(&value)

	if workspaceID != "" {
		var wsValue string
		if err := conn.QueryRow(
			`SELECT value FROM workspace_settings WHERE workspace_id = ? AND key = 'drain_masks'`, workspaceID,
		).Scan(&wsValue); err == nil {
			return wsValue
		}
	}
	return value
}

func (r *ToolRegistry) writeDrainMasksSetting(conn *sql.DB, workspaceID, value string) error {
	if workspaceID != "" {
		_, err := conn.Exec(
			`INSERT INTO workspace_settings (workspace_id, key, value) VALUES (?, 'drain_masks', ?)
			 ON CONFLICT (workspace_id, key) DO UPDATE SET value = excluded.value`,
			workspaceID, value,
		)
		return err
	}
	_, err := conn.Exec(
		`INSERT INTO settings (key, value) VALUES ('drain_masks', ?)
		 ON CONFLICT (key) DO UPDATE SET value = excluded.value`,
		value,
	)
	return err
}
