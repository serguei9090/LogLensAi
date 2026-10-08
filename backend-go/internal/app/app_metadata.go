package app

import (
	"database/sql"
	"encoding/json"
	"log"
	"path/filepath"
	"strings"

	"loglensai/backend-go/internal/metadata"
)

// Settings is the exported form of getSettings, for callers outside this
// package (e.g. internal/ai's provider-from-settings construction) that need
// the same merged global + workspace-override settings view RPC handlers use
// internally. workspaceID may be "" for the global-only view.
func (a *App) Settings(workspaceID string) map[string]string {
	return a.getSettings(workspaceID)
}

// getSettings returns the merged global + (if workspaceID != "") workspace
// override settings map, mirroring api.py's method_get_settings. Query
// failures degrade to an empty/partial map rather than erroring — settings
// always have code-level fallbacks throughout this package, matching
// Python's dict.get(key, default) usage pattern at every call site.
func (a *App) getSettings(workspaceID string) map[string]string {
	out := make(map[string]string)

	if rows, err := a.DB.Conn.Query(`SELECT key, value FROM settings`); err == nil {
		for rows.Next() {
			var k, v string
			if rows.Scan(&k, &v) == nil {
				out[k] = v
			}
		}
		rows.Close()
	}

	if workspaceID != "" {
		if rows, err := a.DB.Conn.Query(
			`SELECT key, value FROM workspace_settings WHERE workspace_id = ?`, workspaceID,
		); err == nil {
			for rows.Next() {
				var k, v string
				if rows.Scan(&k, &v) == nil {
					out[k] = v
				}
			}
			rows.Close()
		}
	}

	return out
}

// metadataConfigResolver implements clustering.MetadataConfigResolver
// against the real database, resolving per-(workspace, source) facet rules
// and parser config the way api.py's _ingest_source_logs_batch /
// _bg_ingest_local_file do.
type metadataConfigResolver struct {
	app *App
}

// RulesFor implements clustering.MetadataConfigResolver.
func (r *metadataConfigResolver) RulesFor(workspaceID string) []metadata.Rule {
	global, ws, err := r.app.DB.FacetExtractionRulesJSON(workspaceID)
	if err != nil {
		log.Printf("[App] Failed to load facet rules for %s: %v", workspaceID, err)
		return nil
	}
	var rules []metadata.Rule
	rules = append(rules, parseFacetRulesJSON(global)...)
	rules = append(rules, parseFacetRulesJSON(ws)...)
	return rules
}

// ParserConfigFor implements clustering.MetadataConfigResolver.
func (r *metadataConfigResolver) ParserConfigFor(workspaceID, sourceID string) (*metadata.ParserConfig, float64) {
	raw, tz, err := r.app.DB.FusionParserConfig(workspaceID, sourceID)
	if err != nil {
		log.Printf("[App] Failed to load parser config for %s/%s: %v", workspaceID, sourceID, err)
		return &metadata.ParserConfig{}, 0
	}
	if raw == "" {
		return &metadata.ParserConfig{}, tz
	}
	var parsed parserConfigJSON
	if err := json.Unmarshal([]byte(raw), &parsed); err != nil {
		return &metadata.ParserConfig{}, tz
	}
	return parsed.toParserConfig(), tz
}

type parserConfigJSON struct {
	TimestampRegex      string `json:"timestamp_regex"`
	TimestampFormat     string `json:"timestamp_format"`
	Regex               string `json:"regex"`
	TimestampAutoDetect *bool  `json:"timestamp_auto_detect"`
}

func (p parserConfigJSON) toParserConfig() *metadata.ParserConfig {
	return &metadata.ParserConfig{
		TimestampRegex:      p.TimestampRegex,
		TimestampFormat:     p.TimestampFormat,
		Regex:               p.Regex,
		TimestampAutoDetect: p.TimestampAutoDetect,
	}
}

type facetRuleJSON struct {
	Name    string `json:"name"`
	Regex   string `json:"regex"`
	Group   int    `json:"group"`
	Enabled *bool  `json:"enabled"`
}

func parseFacetRulesJSON(raw string) []metadata.Rule {
	if raw == "" {
		return nil
	}
	var parsed []facetRuleJSON
	if err := json.Unmarshal([]byte(raw), &parsed); err != nil {
		return nil
	}
	out := make([]metadata.Rule, len(parsed))
	for i, p := range parsed {
		out[i] = metadata.Rule{Name: p.Name, Regex: p.Regex, Group: p.Group, Enabled: p.Enabled}
	}
	return out
}

func (a *App) getFacetRules(workspaceID string) []metadata.Rule {
	return a.metaResolver.RulesFor(workspaceID)
}

func (a *App) getParserConfig(workspaceID, sourceID string) (*metadata.ParserConfig, float64) {
	return a.metaResolver.ParserConfigFor(workspaceID, sourceID)
}

func (a *App) deleteLogs(workspaceID, sourceID string) error {
	var err error
	if sourceID != "" {
		_, err = a.DB.Conn.Exec(`DELETE FROM logs WHERE workspace_id = ? AND source_id = ?`, workspaceID, sourceID)
	} else {
		_, err = a.DB.Conn.Exec(`DELETE FROM logs WHERE workspace_id = ?`, workspaceID)
	}
	return err
}

func (a *App) sourceIsUploaded(sourceID string) bool {
	var uploaded sql.NullBool
	row := a.DB.Conn.QueryRow(`SELECT is_uploaded FROM log_sources WHERE id = ?`, sourceID)
	if err := row.Scan(&uploaded); err != nil {
		return false
	}
	return uploaded.Valid && uploaded.Bool
}

func normalizeAbsPath(p string) string {
	abs, err := filepath.Abs(p)
	if err != nil {
		abs = p
	}
	return strings.ReplaceAll(abs, `\`, "/")
}
