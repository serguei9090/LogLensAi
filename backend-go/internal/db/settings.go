package db

import (
	"database/sql"
	"encoding/json"
	"log"
)

// defaultDrainMasks is the default drain_masks setting value, verbatim from
// db.py:131-157 (already using the fixed \b-word-boundary IP pattern, not
// the broken lookbehind variant migrateDrainMasks repairs on legacy DBs).
var defaultDrainMasks = []maskRule{
	{
		Pattern: `\b(\d{1,3}\.\d{1,3}\.\d{1,3}\.\d{1,3})\b`,
		Label:   "IP",
		Enabled: true,
	},
	{
		Pattern: `[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{12}`,
		Label:   "UUID",
		Enabled: true,
	},
	{
		Pattern: `\b([1-5][0-9]{2})\b`,
		Label:   "HTTP_STATUS",
		Enabled: true,
	},
	{
		Pattern: `\b(GET|POST|PUT|DELETE|PATCH|HEAD|OPTIONS|TRACE)\b`,
		Label:   "HTTP_METHOD",
		Enabled: true,
	},
	{
		Pattern: `\b(0x[0-9a-fA-F]+|[0-9a-fA-F]{16,64})\b`,
		Label:   "HEX",
		Enabled: true,
	},
	{
		Pattern: `\b\d+(?:\.\d+)?(?:ms|s|ns|µs|m)\b`,
		Label:   "DURATION",
		Enabled: true,
	},
	{
		Pattern: `\b[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}\b`,
		Label:   "EMAIL",
		Enabled: true,
	},
	{
		Pattern: `\b(?:[0-9a-fA-F]{2}[:-]){5}[0-9a-fA-F]{2}\b`,
		Label:   "MAC",
		Enabled: true,
	},
	{
		Pattern: `\b\d{4}-\d{2}-\d{2}[T ]\d{2}:\d{2}:\d{2}(?:\.\d+)?(?:Z|[+-]\d{2}:?\d{2})?\b`,
		Label:   "DATETIME",
		Enabled: true,
	},
	{
		Pattern: `\b(https?://[^\s]+|/[a-zA-Z0-9_\-\./]+)\b`,
		Label:   "PATH",
		Enabled: false,
	},
	{
		Pattern: `\b\d+\b`,
		Label:   "NUM",
		Enabled: false,
	},
}

// commandPaletteShortcut mirrors db.py:164's
// json.dumps({"key": "k", "ctrl": True}).
type commandPaletteShortcut struct {
	Key  string `json:"key"`
	Ctrl bool   `json:"ctrl"`
}

// initializeDefaultSettings ports db.py:_initialize_default_settings
// (db.py:109-172): seeds the settings table with defaults, but only if it
// is currently empty (so it never clobbers user-modified settings).
func initializeDefaultSettings(conn *sql.DB) error {
	var count int
	if err := conn.QueryRow(`SELECT COUNT(*) FROM settings`).Scan(&count); err != nil {
		return err
	}
	if count != 0 {
		return nil
	}

	log.Println("[DB] Seeding default settings...")

	drainMasksJSON, err := json.Marshal(defaultDrainMasks)
	if err != nil {
		return err
	}
	shortcutJSON, err := json.Marshal(commandPaletteShortcut{Key: "k", Ctrl: true})
	if err != nil {
		return err
	}

	// Order matches db.py's `defaults` dict for easy side-by-side diffing;
	// insertion order has no functional effect (settings has no ordering
	// dependency), but keeping it 1:1 makes future audits trivial.
	defaults := []struct{ key, value string }{
		{"ai_provider", "ollama"},
		{"ai_model", "gemma4:e2b"},
		{"ai_api_key", ""},
		{"ai_gemini_api_key", ""},
		{"ai_openai_api_key", ""},
		{"ai_openrouter_api_key", ""},
		{"ai_openai_compat_api_key", ""},
		{"ai_system_prompt", "You are LogLens Assistant, a senior DevOps engineer and SRE specializing in root cause analysis."},
		{"ai_gemini_url", "http://localhost:22436"},
		{"ai_ollama_host", "http://localhost:11434"},
		{"ai_openai_host", "https://api.openai.com/v1"},
		{"ai_openrouter_host", "https://openrouter.ai/api/v1"},
		{"ai_lmstudio_host", "http://localhost:1234/v1"},
		{"drain_similarity_threshold", "0.5"},
		{"drain_max_children", "100"},
		{"drain_max_clusters", "1000"},
		{"ui_row_height", "36px"},
		{"ui_font_size", "13px"},
		{"mcp_server_enabled", "false"},
		{"ai_tool_search", "true"},
		{"ai_tool_memory", "true"},
		{"drain_template_scope", "global"},
		{"drain_masks", string(drainMasksJSON)},
		{"ingestion_syslog_enabled", "false"},
		{"ingestion_syslog_port", "514"},
		{"ingestion_http_enabled", "false"},
		{"ingestion_http_port", "5002"},
		{"facet_extractions", "[]"},
		{"ui_command_palette_shortcut", string(shortcutJSON)},
		{"rag_embedder_type", "onnx"},
		{"rag_device", "cpu"},
		{"rag_knowledge_path", ""},
		{"rag_ollama_host", "http://localhost:11434"},
	}

	for _, d := range defaults {
		if _, err := conn.Exec(`INSERT INTO settings (key, value) VALUES (?, ?)`, d.key, d.value); err != nil {
			return err
		}
	}
	return nil
}
