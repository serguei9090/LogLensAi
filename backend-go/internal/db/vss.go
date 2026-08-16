package db

// vss.go adds DuckDB VSS (vector similarity search) support for the
// internal/ai/rag package, replacing Python's LanceDB-backed `ai_memory`
// table. Per the migration plan this is a new, standalone file: it does not
// modify schema.go/migrations.go (the ai_memory table itself was already
// created there in an earlier phase, with workspace_id/issue_signature/
// resolution/created_at columns and a (workspace_id, issue_signature)
// primary key) -- this file only adds the embedding column and its index,
// idempotently, the same way migrations.go's own migrate* functions do.
//
// Environment finding (see SetupVectorSearch's doc comment for the full
// story): the `vss` extension could not actually be installed in this dev
// environment. `INSTALL vss` failed with an HTTP 404 fetching
// http://extensions.duckdb.org/v1.1.3/windows_amd64_mingw/vss.duckdb_extension.gz
// -- DuckDB's extension repository does not publish *any* extension
// (confirmed for vss, json, parquet, fts, icu, autocomplete) for the
// "windows_amd64_mingw" platform tag at the DuckDB core version go-duckdb
// v1.8.5 embeds (1.1.3); only "windows_amd64" (MSVC-built) has them. go-duckdb
// necessarily builds DuckDB with MinGW on Windows (cgo on Windows requires
// MinGW, not MSVC -- the same root cause the yalue/onnxruntime_go README
// cites for its own Windows workaround), so its "platform" for extension
// purposes is windows_amd64_mingw, and there's no matching vss build.
// (json/parquet still work because go-duckdb statically links those two
// directly into libduckdb rather than loading them as extensions.)
//
// This is a real, environment-specific gap, not a code bug -- on Linux/macOS
// (where go-duckdb's platform tag has a published vss build) or on Windows
// with a future go-duckdb release that ships a newer DuckDB core, LoadVSS
// below should succeed outright. Rather than hard-depend on it, this file
// degrades gracefully: `array_distance`/`array_cosine_distance` (the scalar
// distance functions ai/rag's queries use) are core DuckDB functionality
// available with or without the vss extension -- confirmed empirically here.
// vss only adds the HNSW *index* that makes nearest-neighbor search sub-linear.
// So SetupVectorSearch always leaves ai/rag fully functional; the only
// difference without vss is that SearchMemory does an exact brute-force scan
// over each workspace's memories instead of an approximate index lookup --
// entirely reasonable for the realistic size of a per-workspace "saved
// issue resolutions" memory table (tens to low thousands of rows, not
// millions).
import (
	"database/sql"
	"fmt"
	"log"
)

// AIMemoryEmbeddingDim is the width of the ai_memory.embedding vector column.
// It matches nomic-embed-text-v1.5's hidden_size (768), which is also what
// Python's LanceDB schema already used -- see internal/ai/rag.EmbeddingDim's
// doc comment for how that was confirmed.
const AIMemoryEmbeddingDim = 768

// aiMemoryVectorIndexName is the HNSW index created on ai_memory.embedding
// when the vss extension is available.
const aiMemoryVectorIndexName = "ai_memory_embedding_idx"

// VSSStatus reports what SetupVectorSearch actually managed to set up, so
// callers (internal/ai/rag) can log/report the degraded mode honestly rather
// than silently pretending everything is index-accelerated.
type VSSStatus struct {
	// ExtensionLoaded is true if `INSTALL vss; LOAD vss;` succeeded.
	ExtensionLoaded bool
	// IndexCreated is true if the HNSW index on ai_memory.embedding exists
	// (either created just now or already present from a prior run).
	IndexCreated bool
	// Degraded explains, in one line, why search will fall back to a
	// brute-force table scan. Empty when everything (including the HNSW
	// index) is set up.
	Degraded string
}

// SetupVectorSearch idempotently prepares ai_memory for vector search:
//  1. Adds the `embedding FLOAT[768]` column if it isn't already there
//     (ai_memory itself, and its other columns, are created by schema.go --
//     see this file's package doc comment for why that's not duplicated
//     here).
//  2. Attempts `INSTALL vss; LOAD vss;`.
//  3. If that succeeded, creates an HNSW index on the embedding column.
//
// It never returns an error for vss/HNSW being unavailable -- that's a
// supported, expected degraded mode (see VSSStatus.Degraded) -- only for
// failures preparing the base schema (the ALTER TABLE), which would make
// ai/rag non-functional outright.
func SetupVectorSearch(conn *sql.DB) (VSSStatus, error) {
	var status VSSStatus

	if err := ensureAIMemoryEmbeddingColumn(conn, AIMemoryEmbeddingDim); err != nil {
		return status, fmt.Errorf("db: adding ai_memory.embedding column: %w", err)
	}

	if err := loadVSSExtension(conn); err != nil {
		status.Degraded = fmt.Sprintf(
			"vss extension unavailable (%v); ai_memory vector search will use a brute-force scan instead of an HNSW index", err)
		log.Printf("[DB] %s", status.Degraded)
		return status, nil
	}
	status.ExtensionLoaded = true

	if err := ensureAIMemoryVectorIndex(conn); err != nil {
		status.Degraded = fmt.Sprintf(
			"vss loaded but HNSW index creation failed (%v); ai_memory vector search will use a brute-force scan instead", err)
		log.Printf("[DB] %s", status.Degraded)
		return status, nil
	}
	status.IndexCreated = true
	return status, nil
}

// loadVSSExtension runs `INSTALL vss; LOAD vss;`. Both statements are
// naturally idempotent (DuckDB no-ops re-installing/re-loading an already
// loaded extension), so this can be called on every startup.
func loadVSSExtension(conn *sql.DB) error {
	if _, err := conn.Exec(`INSTALL vss;`); err != nil {
		return err
	}
	if _, err := conn.Exec(`LOAD vss;`); err != nil {
		return err
	}
	return nil
}

// ensureAIMemoryEmbeddingColumn adds the embedding vector column to the
// pre-existing ai_memory table if it isn't already present, following the
// same columnExists-gated pattern migrations.go uses for its own ALTER
// TABLE ADD COLUMN migrations.
func ensureAIMemoryEmbeddingColumn(conn *sql.DB, dim int) error {
	ok, err := columnExists(conn, "ai_memory", "embedding")
	if err != nil {
		return err
	}
	if ok {
		return nil
	}
	_, err = conn.Exec(fmt.Sprintf(`ALTER TABLE ai_memory ADD COLUMN embedding FLOAT[%d]`, dim))
	return err
}

// ensureAIMemoryVectorIndex creates the HNSW index used to accelerate
// nearest-neighbor search over ai_memory.embedding. Only called once
// loadVSSExtension has succeeded.
func ensureAIMemoryVectorIndex(conn *sql.DB) error {
	// HNSW indexes on a disk-backed (non-:memory:) database require opting
	// in to DuckDB's experimental index persistence, or the index silently
	// isn't restored after a restart. Harmless to set for :memory: too.
	if _, err := conn.Exec(`SET hnsw_enable_experimental_persistence = true;`); err != nil {
		return err
	}
	_, err := conn.Exec(fmt.Sprintf(
		`CREATE INDEX IF NOT EXISTS %s ON ai_memory USING HNSW (embedding) WITH (metric = 'cosine');`,
		aiMemoryVectorIndexName,
	))
	return err
}
