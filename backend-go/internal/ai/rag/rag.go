package rag

// rag.go is the Go port of sidecar/src/services/rag_service.py's
// RagService.save_memory/search_memory. Storage moves from LanceDB to
// DuckDB's VSS-adjacent functionality (see internal/db/vss.go); embeddings
// come from the same nomic-embed-text-v1.5 model via embed.go.
//
// Security/correctness fix versus the Python source: rag_service.py builds
// its workspace filter with raw string interpolation --
// `.where(f"workspace_id = '{workspace_id}'")` (rag_service.py:145) -- which
// is a SQL/filter-expression injection vector if workspace_id ever contains
// attacker-influenced content (e.g. a single quote breaks out of the string
// literal and injects arbitrary LanceDB filter syntax). Every query in this
// file binds workspace_id (and every other value) as a driver parameter
// (`?`), never string-concatenated, so this class of bug does not exist in
// the Go port.

import (
	"context"
	"database/sql"
	"fmt"
	"strconv"
	"strings"
	"time"

	"loglensai/backend-go/internal/db"
)

// MemoryResult is one row returned by SearchMemory, matching the dict shape
// rag_service.py's search_memory returns: {issue_signature, resolution,
// created_at, distance}.
type MemoryResult struct {
	IssueSignature string
	Resolution     string
	CreatedAt      time.Time
	// Distance is the vector distance (cosine distance metric -- lower is
	// more similar) between the query embedding and this memory's saved
	// embedding, as computed by DuckDB's array_cosine_distance(). Python's
	// equivalent is LanceDB's `_distance` column (rag_service.py:155), but
	// that used LanceDB's default (L2) metric; since both vectors are
	// always L2-normalized (Embed guarantees this), L2 and cosine distance
	// are monotonically related and produce identical nearest-neighbor
	// rankings, just on a different numeric scale -- cosine was chosen here
	// to match the metric the HNSW index is built with (see
	// internal/db.SetupVectorSearch, `WITH (metric = 'cosine')`), so the
	// index-accelerated and brute-force-fallback code paths always agree.
	Distance float64
}

// Service is the Go equivalent of rag_service.py's RagService: a per-process
// handle for saving and semantically searching workspace "issue -> resolution"
// memories.
type Service struct {
	conn      *sql.DB
	embedder  *Embedder
	vssStatus db.VSSStatus
	exporter  *MemoryMarkdownExporter
}

// SetExporter sets an optional Markdown exporter for writing resolutions to disk.
func (s *Service) SetExporter(exporter *MemoryMarkdownExporter) {
	s.exporter = exporter
}

// NewService prepares the ai_memory table for vector search (idempotent --
// see internal/db.SetupVectorSearch) and wraps it together with embedder for
// use by SaveMemory/SearchMemory. embedder is owned by the caller; Service
// does not close it.
func NewService(conn *sql.DB, embedder *Embedder) (*Service, error) {
	status, err := db.SetupVectorSearch(conn)
	if err != nil {
		return nil, fmt.Errorf("rag: preparing vector search schema: %w", err)
	}
	return &Service{conn: conn, embedder: embedder, vssStatus: status}, nil
}

// VSSStatus reports whether the HNSW index is actually in use, or whether
// SearchMemory is falling back to a brute-force distance scan. See
// internal/db.VSSStatus's doc comment for why the fallback is safe.
func (s *Service) VSSStatus() db.VSSStatus {
	return s.vssStatus
}

// SaveMemory embeds issueSignature (as a *document*, per Nomic's
// document/query prefix distinction -- rag_service.py:115 does the same) and
// upserts the (workspace_id, issue_signature, resolution, embedding) row.
//
// Save is an upsert keyed on (workspace_id, issue_signature): the pre-existing
// ai_memory table (created in an earlier migration phase, see
// internal/db/schema.go) has a PRIMARY KEY on exactly those two columns,
// unlike Python's LanceDB table, which has no primary key and simply
// accumulates a duplicate row on every save of the same issue signature.
// Upserting here is a deliberate, forced-by-the-existing-schema improvement
// (no silently-growing duplicate memories), not a behavior this file chose
// unprompted. It's implemented as DELETE-then-INSERT rather than
// `INSERT ... ON CONFLICT DO UPDATE`, because this DuckDB version (1.1.3,
// bundled by go-duckdb v1.8.5) does not support UPDATE on ARRAY-typed
// columns ("Not implemented Error: Array Update is not supported.",
// confirmed empirically) -- DO UPDATE would fail specifically on the
// embedding column.
//
// The DELETE and INSERT are deliberately two separate autocommitted
// statements rather than one explicit transaction: wrapping them in a
// transaction was tried first and hit a real, confirmed DuckDB limitation --
// deleting and re-inserting the same primary key inside a single transaction
// raises "Constraint Error: Duplicate key ... violates primary key
// constraint", because the ART index's delete is only logically applied
// until commit (DuckDB's own docs link this exact failure mode under "known
// index limitations", https://duckdb.org/docs/sql/indexes). Splitting into
// two autocommitted statements sidesteps it at the cost of atomicity: a
// crash between the DELETE and INSERT would leave the old memory row
// missing rather than stale. That's an acceptable tradeoff for a
// best-effort memory cache (worst case, one save is lost and the caller can
// retry), not for data that must never disappear.
func (s *Service) SaveMemory(ctx context.Context, workspaceID, issueSignature, resolution string) error {
	vector, err := s.embedder.Embed(ctx, issueSignature, false)
	if err != nil {
		return fmt.Errorf("rag: embedding issue signature: %w", err)
	}
	if len(vector) != db.AIMemoryEmbeddingDim {
		return fmt.Errorf("rag: embedder returned a %d-dim vector, want %d", len(vector), db.AIMemoryEmbeddingDim)
	}

	if _, err := s.conn.ExecContext(ctx,
		`DELETE FROM ai_memory WHERE workspace_id = ? AND issue_signature = ?`,
		workspaceID, issueSignature,
	); err != nil {
		return fmt.Errorf("rag: clearing prior memory row: %w", err)
	}

	insertSQL := `INSERT INTO ai_memory (workspace_id, issue_signature, resolution, embedding, created_at)
	              VALUES (?, ?, ?, ` + vectorLiteralPlaceholder(len(vector)) + `, CURRENT_TIMESTAMP)`
	args := make([]any, 0, 3+len(vector))
	args = append(args, workspaceID, issueSignature, resolution)
	args = append(args, vectorArgs(vector)...)

	if _, err := s.conn.ExecContext(ctx, insertSQL, args...); err != nil {
		return fmt.Errorf("rag: inserting memory row: %w", err)
	}

	if s.exporter != nil {
		if _, err := s.exporter.ExportResolution(workspaceID, issueSignature, resolution); err != nil {
			// Log error but don't fail the primary save
			fmt.Printf("rag: warning: failed to export resolution markdown: %v\n", err)
		}
	}

	return nil
}

// SearchMemory embeds query (as a *query*, per Nomic's prefix distinction --
// rag_service.py:138 does the same) and returns the limit closest memories
// saved for workspaceID, nearest first.
//
// workspace_id is bound as a query parameter (`?`), not string-interpolated
// -- see this file's package doc comment for the injection issue this fixes
// versus rag_service.py.
//
// Unlike rag_service.py's search_memory, which swallows every error from the
// underlying search and returns an empty list (rag_service.py:159-161,
// `except Exception: logger.exception(...); return []`), this returns the
// error to the caller. Silently returning "no memories found" on a genuine
// DB/query error (as opposed to "no memories exist") hides real failures
// from whatever's calling this (e.g. the AI tool-calling graph in
// internal/ai/graph) -- callers that want Python's "never fail, just return
// nothing" behavior can choose to swallow the error themselves.
func (s *Service) SearchMemory(ctx context.Context, workspaceID, query string, limit int) ([]MemoryResult, error) {
	if limit <= 0 {
		limit = 5
	}

	vector, err := s.embedder.Embed(ctx, query, true)
	if err != nil {
		return nil, fmt.Errorf("rag: embedding query: %w", err)
	}
	if len(vector) != db.AIMemoryEmbeddingDim {
		return nil, fmt.Errorf("rag: embedder returned a %d-dim vector, want %d", len(vector), db.AIMemoryEmbeddingDim)
	}

	searchSQL := `SELECT issue_signature, resolution, created_at,
	                     array_cosine_distance(embedding, ` + vectorLiteralPlaceholder(len(vector)) + `) AS distance
	              FROM ai_memory
	              WHERE workspace_id = ? AND embedding IS NOT NULL
	              ORDER BY distance ASC
	              LIMIT ?`
	args := make([]any, 0, len(vector)+2)
	args = append(args, vectorArgs(vector)...)
	args = append(args, workspaceID, limit)

	rows, err := s.conn.QueryContext(ctx, searchSQL, args...)
	if err != nil {
		return nil, fmt.Errorf("rag: searching memory: %w", err)
	}
	defer rows.Close()

	var results []MemoryResult
	for rows.Next() {
		var m MemoryResult
		if err := rows.Scan(&m.IssueSignature, &m.Resolution, &m.CreatedAt, &m.Distance); err != nil {
			return nil, fmt.Errorf("rag: scanning search result: %w", err)
		}
		results = append(results, m)
	}
	if err := rows.Err(); err != nil {
		return nil, fmt.Errorf("rag: iterating search results: %w", err)
	}
	return results, nil
}

// vectorLiteralPlaceholder builds a fully-parameterized SQL expression for an
// n-dimensional float vector: `list_value(?, ?, ..., ?)::FLOAT[n]`. Every
// element is bound as an individual `?` placeholder (see vectorArgs) --
// go-duckdb's database/sql driver does not support binding a Go slice
// directly to an ARRAY/LIST-typed parameter (confirmed empirically:
// `duckdb: unsupported type ARRAY/LIST` from Stmt.bindComplexValue), so
// list_value(...) is the parameterized escape hatch. n itself is always a
// compile-time-controlled constant (db.AIMemoryEmbeddingDim, via the
// embedder's fixed output width) -- never attacker input -- so formatting it
// into the SQL text is safe.
func vectorLiteralPlaceholder(n int) string {
	placeholders := make([]string, n)
	for i := range placeholders {
		placeholders[i] = "?"
	}
	return "list_value(" + strings.Join(placeholders, ",") + ")::FLOAT[" + strconv.Itoa(n) + "]"
}

// vectorArgs converts a []float32 into the []any argument list matching
// vectorLiteralPlaceholder's placeholders.
func vectorArgs(vector []float32) []any {
	args := make([]any, len(vector))
	for i, f := range vector {
		args[i] = f
	}
	return args
}
