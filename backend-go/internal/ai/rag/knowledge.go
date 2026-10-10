package rag

import (
	"context"
	"fmt"
	"os"
	"path/filepath"
	"strings"
	"time"
)

// DocumentChunk represents a chunked unit of text from a knowledge file.
type DocumentChunk struct {
	ID        string
	FilePath  string
	FileType  string
	Index     int
	Content   string
	Embedding []float32
}

// KnowledgeSearchResult represents a match returned by SearchKnowledge.
type KnowledgeSearchResult struct {
	ID       string    `json:"id"`
	FilePath string    `json:"file_path"`
	FileType string    `json:"file_type"`
	Content  string    `json:"content"`
	Distance float64   `json:"distance"`
	Score    float64   `json:"score"`
}

// IngestKnowledgeFile reads a supported file (.md, .txt, .pdf, or image metadata),
// splits text into overlapping chunks, computes embeddings, and persists to knowledge_documents.
func (s *Service) IngestKnowledgeFile(ctx context.Context, workspaceID, filePath string) (int, error) {
	ext := strings.ToLower(filepath.Ext(filePath))
	var content string

	switch ext {
	case ".md", ".txt":
		data, err := os.ReadFile(filePath)
		if err != nil {
			return 0, fmt.Errorf("rag: reading text file %s: %w", filePath, err)
		}
		content = string(data)
	case ".pdf":
		// Best-effort pure text scan for standard text-based PDFs
		data, err := os.ReadFile(filePath)
		if err != nil {
			return 0, fmt.Errorf("rag: reading pdf file %s: %w", filePath, err)
		}
		content = extractTextFromRawPDF(data)
		if strings.TrimSpace(content) == "" {
			return 0, nil // Skip empty / image-only scanned PDFs gracefully
		}
	case ".png", ".jpg", ".jpeg":
		// Generate an image diagram knowledge card from file metadata & filename
		baseName := filepath.Base(filePath)
		content = fmt.Sprintf("Visual Architecture Diagram / Incident Error Capture: %s (Type: %s, Path: %s)", baseName, ext, filePath)
	default:
		return 0, nil // Unsupported format
	}

	chunks := RecursiveChunkText(content, 500, 50)
	if len(chunks) == 0 {
		return 0, nil
	}

	// Clear previous chunks for this file
	_, err := s.conn.ExecContext(ctx,
		`DELETE FROM knowledge_documents WHERE workspace_id = ? AND file_path = ?`,
		workspaceID, filePath,
	)
	if err != nil {
		return 0, fmt.Errorf("rag: clearing prior document chunks: %w", err)
	}

	insertedCount := 0
	for i, chunk := range chunks {
		trimmed := strings.TrimSpace(chunk)
		if trimmed == "" {
			continue
		}

		vector, err := s.embedder.Embed(ctx, trimmed, false)
		if err != nil {
			return insertedCount, fmt.Errorf("rag: embedding chunk %d: %w", i, err)
		}

		chunkID := fmt.Sprintf("%s_%d_%d", SanitizeFilename(filepath.Base(filePath)), i, time.Now().UnixNano()%10000)
		insertSQL := `INSERT INTO knowledge_documents (id, workspace_id, file_path, file_type, chunk_index, content, embedding, updated_at)
		              VALUES (?, ?, ?, ?, ?, ?, ` + vectorLiteralPlaceholder(len(vector)) + `, CURRENT_TIMESTAMP)`
		args := make([]any, 0, 6+len(vector))
		args = append(args, chunkID, workspaceID, filePath, ext, i, trimmed)
		args = append(args, vectorArgs(vector)...)

		if _, err := s.conn.ExecContext(ctx, insertSQL, args...); err != nil {
			return insertedCount, fmt.Errorf("rag: inserting chunk %d: %w", i, err)
		}
		insertedCount++
	}

	return insertedCount, nil
}

// SearchKnowledge semantically searches indexed documents, runbooks, and diagrams in knowledge_documents.
func (s *Service) SearchKnowledge(ctx context.Context, workspaceID, query string, limit int) ([]KnowledgeSearchResult, error) {
	if limit <= 0 {
		limit = 5
	}

	vector, err := s.embedder.Embed(ctx, query, true)
	if err != nil {
		return nil, fmt.Errorf("rag: embedding query for knowledge search: %w", err)
	}

	searchSQL := `SELECT id, file_path, file_type, content,
	                     array_cosine_distance(embedding, ` + vectorLiteralPlaceholder(len(vector)) + `) AS distance
	              FROM knowledge_documents
	              WHERE workspace_id = ? AND embedding IS NOT NULL
	              ORDER BY distance ASC
	              LIMIT ?`
	args := make([]any, 0, len(vector)+2)
	args = append(args, vectorArgs(vector)...)
	args = append(args, workspaceID, limit)

	rows, err := s.conn.QueryContext(ctx, searchSQL, args...)
	if err != nil {
		return nil, fmt.Errorf("rag: searching knowledge: %w", err)
	}
	defer rows.Close()

	var results []KnowledgeSearchResult
	for rows.Next() {
		var r KnowledgeSearchResult
		if err := rows.Scan(&r.ID, &r.FilePath, &r.FileType, &r.Content, &r.Distance); err != nil {
			return nil, fmt.Errorf("rag: scanning knowledge match: %w", err)
		}
		r.Score = 1.0 - r.Distance
		results = append(results, r)
	}

	return results, nil
}

// RecursiveChunkText splits text into segments around chunkSize characters with overlap.
func RecursiveChunkText(text string, chunkSize, overlap int) []string {
	clean := strings.TrimSpace(text)
	if len(clean) == 0 {
		return nil
	}
	if len(clean) <= chunkSize {
		return []string{clean}
	}

	var chunks []string
	start := 0
	for start < len(clean) {
		end := start + chunkSize
		if end >= len(clean) {
			chunks = append(chunks, clean[start:])
			break
		}

		// Try to break on newline or space boundary
		splitIdx := strings.LastIndex(clean[start:end], "\n")
		if splitIdx == -1 || splitIdx < chunkSize/2 {
			splitIdx = strings.LastIndex(clean[start:end], " ")
		}

		if splitIdx > 0 {
			chunks = append(chunks, clean[start:start+splitIdx])
			start += splitIdx - overlap
		} else {
			chunks = append(chunks, clean[start:end])
			start = end - overlap
		}

		if start < 0 {
			start = 0
		}
	}
	return chunks
}

// extractTextFromRawPDF extracts visible ASCII / UTF-8 strings from raw PDF streams.
func extractTextFromRawPDF(data []byte) string {
	raw := string(data)
	var b strings.Builder
	for _, line := range strings.Split(raw, "\n") {
		trimmed := strings.TrimSpace(line)
		if strings.HasPrefix(trimmed, "(") && strings.HasSuffix(trimmed, ")") {
			b.WriteString(trimmed[1 : len(trimmed)-1])
			b.WriteString(" ")
		} else if strings.Contains(trimmed, "BT") || strings.Contains(trimmed, "ET") {
			continue
		} else if len(trimmed) > 10 && !strings.Contains(trimmed, "%") && !strings.Contains(trimmed, "obj") {
			// Extract plain text runs
			b.WriteString(trimmed)
			b.WriteString("\n")
		}
	}
	return b.String()
}
