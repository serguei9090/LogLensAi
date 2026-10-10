package rag

import (
	"os"
	"path/filepath"
	"strings"
	"testing"
)

func TestSanitizeFilename(t *testing.T) {
	tests := []struct {
		input    string
		expected string
	}{
		{"ConnectionTimeout to /api/auth:8080", "ConnectionTimeout_to_api_auth_8080"},
		{"[CRITICAL] Out of Memory: Pod Eviction", "CRITICAL_Out_of_Memory_Pod_Eviction"},
		{"", "issue_resolution"},
		{"///:::***", "issue_resolution"},
	}

	for _, tc := range tests {
		got := SanitizeFilename(tc.input)
		if !strings.HasPrefix(got, tc.expected[:min(len(tc.expected), 20)]) {
			t.Errorf("SanitizeFilename(%q) = %q; want prefix %q", tc.input, got, tc.expected)
		}
	}
}

func TestMemoryMarkdownExporter(t *testing.T) {
	tmpDir, err := os.MkdirTemp("", "rag_export_test_*")
	if err != nil {
		t.Fatalf("failed to create temp dir: %v", err)
	}
	defer os.RemoveAll(tmpDir)

	exporter, err := NewMemoryMarkdownExporter(tmpDir)
	if err != nil {
		t.Fatalf("NewMemoryMarkdownExporter failed: %v", err)
	}

	filePath, err := exporter.ExportResolution("test-ws", "Database Deadlock in Auth", "Recycle pool connections")
	if err != nil {
		t.Fatalf("ExportResolution failed: %v", err)
	}

	if _, err := os.Stat(filePath); os.IsNotExist(err) {
		t.Fatalf("expected file to exist at %s, but does not", filePath)
	}

	contentBytes, err := os.ReadFile(filePath)
	if err != nil {
		t.Fatalf("failed to read exported file: %v", err)
	}
	content := string(contentBytes)

	if !strings.Contains(content, `issue_signature: "Database Deadlock in Auth"`) {
		t.Errorf("expected content to contain issue signature frontmatter, got:\n%s", content)
	}
	if !strings.Contains(content, "Recycle pool connections") {
		t.Errorf("expected content to contain resolution, got:\n%s", content)
	}
	if filepath.Dir(filePath) != filepath.Join(tmpDir, "Memory") {
		t.Errorf("expected file in Memory subfolder, got %s", filePath)
	}
}

func min(a, b int) int {
	if a < b {
		return a
	}
	return b
}
