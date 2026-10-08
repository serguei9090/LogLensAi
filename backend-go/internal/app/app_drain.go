package app

import (
	"encoding/json"
	"fmt"
	"log"
	"path/filepath"
	"strconv"

	"loglensai/backend-go/internal/drain3"
)

// drainGlobalKey is the miner-cache key used when drain_template_scope is
// "global" (the default) or no workspace_id is supplied, matching api.py's
// "__global__" sentinel.
const drainGlobalKey = "__global__"

// GetDrainParser resolves (creating and lazily loading from disk if needed)
// the shared drain3.Miner for workspaceID, honoring the `drain_template_scope`
// setting ("global", the default, shares one miner across every workspace;
// anything else gives each workspace its own). Matches the
// clustering.MinerProvider signature so it can be passed directly to
// clustering.NewWorker. Mirrors api.py's App.get_drain_parser.
func (a *App) GetDrainParser(workspaceID string) (*drain3.Miner, error) {
	settings := a.getSettings(workspaceID)
	scope := settings["drain_template_scope"]
	if scope == "" {
		scope = "global"
	}

	key := drainGlobalKey
	if scope != "global" && workspaceID != "" {
		key = workspaceID
	}

	a.minersMu.Lock()
	defer a.minersMu.Unlock()

	if m, ok := a.miners[key]; ok {
		return m, nil
	}

	cfg := drain3.DefaultConfig()
	if v, err := strconv.ParseFloat(settings["drain_similarity_threshold"], 64); err == nil && v > 0 {
		cfg.SimTh = v
	}
	if v, err := strconv.Atoi(settings["drain_max_children"]); err == nil && v > 0 {
		cfg.MaxChildren = v
	}
	if v, err := strconv.Atoi(settings["drain_max_clusters"]); err == nil {
		cfg.MaxClusters = v
	}
	cfg.MaskingInstructions = parseMaskingInstructions(settings["drain_masks"])

	m, err := drain3.NewMiner(cfg)
	if err != nil {
		return nil, fmt.Errorf("app: constructing drain miner for %q: %w", key, err)
	}

	if err := m.LoadFromFile(a.drainStatePath(key)); err != nil {
		log.Printf("[App] Failed to load drain state for %s: %v", key, err)
	}

	a.miners[key] = m
	return m, nil
}

func (a *App) drainStatePath(key string) string {
	if key == drainGlobalKey {
		return filepath.Join(a.drainDir, "global.state")
	}
	return filepath.Join(a.drainDir, "workspace_"+key+".state")
}

// maskRuleJSON mirrors the `drain_masks` setting's on-disk JSON shape
// ({"pattern","label","enabled"} objects), matching db.maskRule
// (internal/db/migrations.go, unexported there).
type maskRuleJSON struct {
	Pattern string `json:"pattern"`
	Label   string `json:"label"`
	Enabled bool   `json:"enabled"`
}

// parseMaskingInstructions decodes the drain_masks setting value (tolerating
// double-encoded JSON, matching api.py's get_drain_parser) into compiled
// drain3.MaskingInstructions.
func parseMaskingInstructions(raw string) []drain3.MaskingInstruction {
	if raw == "" {
		return nil
	}
	var parsed []maskRuleJSON
	if err := json.Unmarshal([]byte(raw), &parsed); err != nil {
		// Tolerate a double-encoded JSON string, matching api.py's fallback.
		var inner string
		if json.Unmarshal([]byte(raw), &inner) == nil {
			_ = json.Unmarshal([]byte(inner), &parsed)
		}
	}
	if len(parsed) == 0 {
		return nil
	}
	rules := make([]drain3.MaskRule, len(parsed))
	for i, p := range parsed {
		rules[i] = drain3.MaskRule{Pattern: p.Pattern, Label: p.Label, Enabled: p.Enabled}
	}
	return drain3.BuildMaskingInstructions(rules)
}
