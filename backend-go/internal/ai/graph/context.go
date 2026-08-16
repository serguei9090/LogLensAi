package graph

import (
	"fmt"
	"strings"
)

// LogEntry is the loosely-typed shape SmartContextManager operates on,
// matching the map[string]any log-row dicts produced by
// internal/app.getLogsInternal (mirroring Python's plain dict logs).
// Recognised keys: "level", "message", "raw_text", "cluster_id".
type LogEntry = map[string]any

// SmartContextManager ports sidecar/src/ai/context.py's SmartContextManager
// verbatim: filtering by level, collapsing repeated clusters, and
// char-based truncation to fit an LLM context window.
type SmartContextManager struct{}

// NewSmartContextManager constructs a SmartContextManager. It holds no
// state -- all methods are pure functions of their arguments, matching the
// Python class (which also holds no instance state).
func NewSmartContextManager() *SmartContextManager {
	return &SmartContextManager{}
}

// FilterLogs keeps only logs whose "level" is in keepLevels, porting
// SmartContextManager.filter_logs.
func (c *SmartContextManager) FilterLogs(logs []LogEntry, keepLevels []string) []LogEntry {
	keep := make(map[string]bool, len(keepLevels))
	for _, l := range keepLevels {
		keep[l] = true
	}
	out := make([]LogEntry, 0, len(logs))
	for _, log := range logs {
		lvl, _ := log["level"].(string)
		if keep[lvl] {
			out = append(out, log)
		}
	}
	return out
}

// SummarizeLogs renders logs as newline-joined lines, collapsing any
// cluster repeated more than threshold times into a single
// "[REPEATED Nx] [Cluster id] msg" line (first occurrence only), porting
// SmartContextManager.summarize_logs.
func (c *SmartContextManager) SummarizeLogs(logs []LogEntry, threshold int) string {
	if len(logs) == 0 {
		return ""
	}

	clusterCounts := make(map[string]int)
	for _, log := range logs {
		if cid := clusterIDString(log["cluster_id"]); cid != "" {
			clusterCounts[cid]++
		}
	}

	var lines []string
	seen := make(map[string]bool)

	for _, log := range logs {
		cid := clusterIDString(log["cluster_id"])
		count := clusterCounts[cid]

		if cid != "" && count > threshold {
			if !seen[cid] {
				lines = append(lines, fmt.Sprintf("[REPEATED %dx] [Cluster %s] %s", count, cid, messageOrRawText(log)))
				seen[cid] = true
			}
			continue
		}

		lvl, _ := log["level"].(string)
		if lvl == "" {
			lvl = "INFO"
		}
		lines = append(lines, fmt.Sprintf("[%s] %s", lvl, messageOrRawText(log)))
	}

	return strings.Join(lines, "\n")
}

// defaultKeepLevels mirrors prepare_log_context's default keep_levels
// argument.
var defaultKeepLevels = []string{"INFO", "WARN", "ERROR", "FATAL", "CRITICAL"}

// summarizeThreshold mirrors summarize_logs' default threshold=3, which
// prepare_log_context relies on implicitly (it calls summarize_logs(filtered)
// with no explicit threshold).
const summarizeThreshold = 3

// PrepareLogContext filters logs to keepLevels (falling back to the first 20
// raw logs if nothing survives the filter), summarizes them, and
// char-truncates the result to approximately maxTokens tokens (~3.5
// chars/token), porting SmartContextManager.prepare_log_context. Passing a
// nil keepLevels uses the same default level set as Python
// (INFO/WARN/ERROR/FATAL/CRITICAL); maxTokens <= 0 defaults to 4000.
func (c *SmartContextManager) PrepareLogContext(logs []LogEntry, maxTokens int, keepLevels []string) string {
	if maxTokens <= 0 {
		maxTokens = 4000
	}
	if keepLevels == nil {
		keepLevels = defaultKeepLevels
	}

	filtered := c.FilterLogs(logs, keepLevels)
	if len(filtered) == 0 {
		if len(logs) > 20 {
			filtered = logs[:20]
		} else {
			filtered = logs
		}
	}

	contextStr := c.SummarizeLogs(filtered, summarizeThreshold)

	maxChars := int(float64(maxTokens) * 3.5)
	if len(contextStr) > maxChars {
		return contextStr[:maxChars] + "\n... [Truncated to fit LLM Context Window]"
	}
	return contextStr
}

func messageOrRawText(log LogEntry) string {
	if m, ok := log["message"].(string); ok && m != "" {
		return m
	}
	if r, ok := log["raw_text"].(string); ok {
		return r
	}
	return ""
}

func clusterIDString(v any) string {
	switch t := v.(type) {
	case string:
		return t
	case nil:
		return ""
	default:
		return fmt.Sprintf("%v", t)
	}
}
