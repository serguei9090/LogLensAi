package rag

import (
	"fmt"
	"os"
	"path/filepath"
	"regexp"
	"strings"
	"time"
)

var nonAlphaNumRegex = regexp.MustCompile(`[^a-zA-Z0-9_-]+`)

// SanitizeFilename creates a safe, cross-platform filename from an issue signature.
func SanitizeFilename(signature string) string {
	clean := strings.TrimSpace(signature)
	clean = nonAlphaNumRegex.ReplaceAllString(clean, "_")
	clean = strings.Trim(clean, "_")
	if len(clean) > 40 {
		clean = clean[:40]
	}
	if clean == "" {
		clean = "issue_resolution"
	}
	return clean
}

// MemoryMarkdownExporter handles writing resolutions as human-readable Markdown files
// into <knowledge_path>/Memory/ with YAML frontmatter.
type MemoryMarkdownExporter struct {
	baseDir string
}

// NewMemoryMarkdownExporter creates a new exporter ensuring the Memory/ subfolder exists.
func NewMemoryMarkdownExporter(knowledgeBaseDir string) (*MemoryMarkdownExporter, error) {
	if knowledgeBaseDir == "" {
		knowledgeBaseDir = "knowledge"
	}
	memDir := filepath.Join(knowledgeBaseDir, "Memory")
	if err := os.MkdirAll(memDir, 0755); err != nil {
		return nil, fmt.Errorf("rag: creating memory folder %s: %w", memDir, err)
	}
	return &MemoryMarkdownExporter{baseDir: memDir}, nil
}

// ExportResolution writes the resolution markdown file with YAML frontmatter to disk.
func (e *MemoryMarkdownExporter) ExportResolution(workspaceID, issueSignature, resolution string) (string, error) {
	safeSlug := SanitizeFilename(issueSignature)
	timestamp := time.Now().UTC()
	dateStr := timestamp.Format("2006-01-02")
	fileName := fmt.Sprintf("%s_%s.md", dateStr, safeSlug)
	targetPath := filepath.Join(e.baseDir, fileName)

	// Clean single and double quotes for yaml frontmatter safety
	safeSignature := strings.ReplaceAll(issueSignature, `"`, `\"`)

	content := fmt.Sprintf(`---
issue_signature: "%s"
workspace_id: "%s"
created_at: %s
tags: ["resolution", "incident-fix"]
---

# Incident Resolution: %s

## Issue Signature
`+"```"+`
%s
`+"```"+`

## Resolution & Mitigations
%s
`,
		safeSignature,
		workspaceID,
		timestamp.Format(time.RFC3339),
		issueSignature,
		issueSignature,
		resolution,
	)

	if err := os.WriteFile(targetPath, []byte(content), 0644); err != nil {
		return "", fmt.Errorf("rag: writing memory file %s: %w", targetPath, err)
	}

	return targetPath, nil
}
