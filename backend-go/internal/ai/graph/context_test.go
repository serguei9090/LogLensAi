package graph

import (
	"strings"
	"testing"
)

func TestFilterLogs(t *testing.T) {
	cm := NewSmartContextManager()
	logs := []LogEntry{
		{"level": "INFO", "message": "a"},
		{"level": "DEBUG", "message": "b"},
		{"level": "ERROR", "message": "c"},
	}
	out := cm.FilterLogs(logs, []string{"INFO", "ERROR"})
	if len(out) != 2 {
		t.Fatalf("expected 2 logs, got %d", len(out))
	}
	if out[0]["message"] != "a" || out[1]["message"] != "c" {
		t.Errorf("unexpected filter result: %+v", out)
	}
}

func TestSummarizeLogs_CollapsesRepeatedClusters(t *testing.T) {
	cm := NewSmartContextManager()
	var logs []LogEntry
	// 5 occurrences of cluster "42" (threshold default 3 -> collapsed),
	// 1 occurrence of cluster "7" (not collapsed, count <= threshold).
	for i := 0; i < 5; i++ {
		logs = append(logs, LogEntry{"level": "ERROR", "message": "boom", "cluster_id": "42"})
	}
	logs = append(logs, LogEntry{"level": "WARN", "message": "once", "cluster_id": "7"})

	out := cm.SummarizeLogs(logs, 3)
	lines := strings.Split(out, "\n")

	repeatedCount := 0
	rawCount := 0
	for _, l := range lines {
		if strings.HasPrefix(l, "[REPEATED 5x] [Cluster 42]") {
			repeatedCount++
		}
		if l == "[ERROR] boom" {
			rawCount++
		}
	}
	if repeatedCount != 1 {
		t.Errorf("expected exactly one collapsed [REPEATED 5x] line, got %d in output:\n%s", repeatedCount, out)
	}
	if rawCount != 0 {
		t.Errorf("expected no raw [ERROR] boom lines once collapsed, got %d in output:\n%s", rawCount, out)
	}
	if !strings.Contains(out, "[WARN] once") {
		t.Errorf("expected uncollapsed [WARN] once line, got:\n%s", out)
	}
}

func TestSummarizeLogs_Empty(t *testing.T) {
	cm := NewSmartContextManager()
	if got := cm.SummarizeLogs(nil, 3); got != "" {
		t.Errorf("expected empty string for no logs, got %q", got)
	}
}

func TestPrepareLogContext_FallbackWhenFilterEmpty(t *testing.T) {
	cm := NewSmartContextManager()
	var logs []LogEntry
	for i := 0; i < 25; i++ {
		logs = append(logs, LogEntry{"level": "DEBUG", "message": "noise"})
	}
	// keep_levels defaults to INFO/WARN/ERROR/FATAL/CRITICAL -- none match
	// DEBUG, so PrepareLogContext should fall back to the first 20 raw logs.
	out := cm.PrepareLogContext(logs, 4000, nil)
	count := strings.Count(out, "[DEBUG] noise")
	if count != 20 {
		t.Errorf("expected fallback to first 20 logs, got %d lines in:\n%s", count, out)
	}
}

func TestPrepareLogContext_Truncates(t *testing.T) {
	cm := NewSmartContextManager()
	var logs []LogEntry
	for i := 0; i < 500; i++ {
		logs = append(logs, LogEntry{"level": "ERROR", "message": strings.Repeat("x", 50)})
	}
	// maxTokens=10 -> maxChars = 35, well below the full summary length.
	out := cm.PrepareLogContext(logs, 10, nil)
	if !strings.HasSuffix(out, "... [Truncated to fit LLM Context Window]") {
		t.Errorf("expected truncation suffix, got:\n%s", out)
	}
	maxChars := 35
	suffixLen := len("\n... [Truncated to fit LLM Context Window]")
	if len(out) != maxChars+suffixLen {
		t.Errorf("unexpected truncated length: got %d, want %d", len(out), maxChars+suffixLen)
	}
}
