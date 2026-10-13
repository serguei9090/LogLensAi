// Assume Role: The Backend Engineer (@backend)

package db

import (
	"database/sql"
	"fmt"
)

// ClusterTriage records AI-evaluated triage dimensions (category, severity, outage indicator)
// produced by the Laya System 1 decision engine and RAG memory checks for a specific cluster template.
type ClusterTriage struct {
	WorkspaceID      string  `json:"workspace_id"`
	ClusterID        string  `json:"cluster_id"`
	Template         string  `json:"template"`
	Category         string  `json:"category"`
	Severity         float64 `json:"severity"`
	IsOutage         bool    `json:"is_outage"`
	Confidence       float64 `json:"confidence"`
	IsKnownIssue     bool    `json:"is_known_issue"`
	RAGTag           string  `json:"rag_tag,omitempty"`
	MatchedSignature string  `json:"matched_signature,omitempty"`
	KnownResolution  string  `json:"known_resolution,omitempty"`
	MatchScore       float64 `json:"match_score,omitempty"`
	UpdatedAt        string  `json:"updated_at,omitempty"`
}

// InitClusterTriageTable ensures the cluster_triage table exists in DuckDB.
func (d *DB) InitClusterTriageTable() error {
	_, err := d.Conn.Exec(`
		CREATE TABLE IF NOT EXISTS cluster_triage (
			workspace_id TEXT,
			cluster_id   TEXT,
			template     TEXT,
			category     TEXT,
			severity     DOUBLE,
			is_outage    BOOLEAN,
			confidence   DOUBLE,
			is_known_issue BOOLEAN DEFAULT FALSE,
			rag_tag      TEXT DEFAULT '',
			matched_signature TEXT DEFAULT '',
			known_resolution  TEXT DEFAULT '',
			match_score  DOUBLE DEFAULT 0.0,
			updated_at   TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
			PRIMARY KEY (workspace_id, cluster_id)
		);
	`)
	if err != nil {
		return fmt.Errorf("clustering: initializing cluster_triage table: %w", err)
	}

	// Graceful column migrations for databases created with earlier schema
	_, _ = d.Conn.Exec(`ALTER TABLE cluster_triage ADD COLUMN IF NOT EXISTS is_known_issue BOOLEAN DEFAULT FALSE;`)
	_, _ = d.Conn.Exec(`ALTER TABLE cluster_triage ADD COLUMN IF NOT EXISTS rag_tag TEXT DEFAULT '';`)
	_, _ = d.Conn.Exec(`ALTER TABLE cluster_triage ADD COLUMN IF NOT EXISTS matched_signature TEXT DEFAULT '';`)
	_, _ = d.Conn.Exec(`ALTER TABLE cluster_triage ADD COLUMN IF NOT EXISTS known_resolution TEXT DEFAULT '';`)
	_, _ = d.Conn.Exec(`ALTER TABLE cluster_triage ADD COLUMN IF NOT EXISTS match_score DOUBLE DEFAULT 0.0;`)

	return nil
}

// UpsertClusterTriage saves or updates triage dimensions for a cluster.
func (d *DB) UpsertClusterTriage(t ClusterTriage) error {
	_, err := d.Conn.Exec(`
		INSERT INTO cluster_triage (
			workspace_id, cluster_id, template, category, severity, is_outage, confidence,
			is_known_issue, rag_tag, matched_signature, known_resolution, match_score, updated_at
		) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, now())
		ON CONFLICT (workspace_id, cluster_id) DO UPDATE SET
			template = excluded.template,
			category = excluded.category,
			severity = excluded.severity,
			is_outage = excluded.is_outage,
			confidence = excluded.confidence,
			is_known_issue = excluded.is_known_issue,
			rag_tag = excluded.rag_tag,
			matched_signature = excluded.matched_signature,
			known_resolution = excluded.known_resolution,
			match_score = excluded.match_score,
			updated_at = now()
	`, t.WorkspaceID, t.ClusterID, t.Template, t.Category, t.Severity, t.IsOutage, t.Confidence,
		t.IsKnownIssue, t.RAGTag, t.MatchedSignature, t.KnownResolution, t.MatchScore)
	if err != nil {
		return fmt.Errorf("clustering: upserting cluster_triage %s/%s: %w", t.WorkspaceID, t.ClusterID, err)
	}
	return nil
}

// UpsertClusterRAGTag saves or updates RAG evaluation dimensions for a cluster.
func (d *DB) UpsertClusterRAGTag(workspaceID, clusterID, template string, isKnown bool, ragTag, matchedSig, knownRes string, matchScore float64) error {
	_, err := d.Conn.Exec(`
		INSERT INTO cluster_triage (
			workspace_id, cluster_id, template, category, severity, is_outage, confidence,
			is_known_issue, rag_tag, matched_signature, known_resolution, match_score, updated_at
		) VALUES (?, ?, ?, 'application', 2.0, false, 0.8, ?, ?, ?, ?, ?, now())
		ON CONFLICT (workspace_id, cluster_id) DO UPDATE SET
			template = CASE WHEN excluded.template != '' THEN excluded.template ELSE cluster_triage.template END,
			is_known_issue = excluded.is_known_issue,
			rag_tag = excluded.rag_tag,
			matched_signature = excluded.matched_signature,
			known_resolution = excluded.known_resolution,
			match_score = excluded.match_score,
			updated_at = now()
	`, workspaceID, clusterID, template, isKnown, ragTag, matchedSig, knownRes, matchScore)
	if err != nil {
		return fmt.Errorf("clustering: upserting cluster RAG tag %s/%s: %w", workspaceID, clusterID, err)
	}
	return nil
}

// GetClusterTriage retrieves triage attributes for a single cluster.
func (d *DB) GetClusterTriage(workspaceID, clusterID string) (*ClusterTriage, error) {
	row := d.Conn.QueryRow(`
		SELECT workspace_id, cluster_id, template, category, severity, is_outage, confidence,
		       COALESCE(is_known_issue, false), COALESCE(rag_tag, ''), COALESCE(matched_signature, ''),
		       COALESCE(known_resolution, ''), COALESCE(match_score, 0.0), CAST(updated_at AS VARCHAR)
		FROM cluster_triage
		WHERE workspace_id = ? AND cluster_id = ?
	`, workspaceID, clusterID)

	var t ClusterTriage
	if err := row.Scan(&t.WorkspaceID, &t.ClusterID, &t.Template, &t.Category, &t.Severity, &t.IsOutage, &t.Confidence,
		&t.IsKnownIssue, &t.RAGTag, &t.MatchedSignature, &t.KnownResolution, &t.MatchScore, &t.UpdatedAt); err != nil {
		if err == sql.ErrNoRows {
			return nil, nil
		}
		return nil, fmt.Errorf("clustering: getting cluster_triage: %w", err)
	}
	return &t, nil
}

// GetClusterTriageMap returns all cluster triage records for a workspace, indexed by cluster_id.
func (d *DB) GetClusterTriageMap(workspaceID string) (map[string]ClusterTriage, error) {
	rows, err := d.Conn.Query(`
		SELECT workspace_id, cluster_id, template, category, severity, is_outage, confidence,
		       COALESCE(is_known_issue, false), COALESCE(rag_tag, ''), COALESCE(matched_signature, ''),
		       COALESCE(known_resolution, ''), COALESCE(match_score, 0.0), CAST(updated_at AS VARCHAR)
		FROM cluster_triage
		WHERE workspace_id = ?
	`, workspaceID)
	if err != nil {
		return nil, fmt.Errorf("clustering: querying cluster_triage map: %w", err)
	}
	defer rows.Close()

	out := make(map[string]ClusterTriage)
	for rows.Next() {
		var t ClusterTriage
		if err := rows.Scan(&t.WorkspaceID, &t.ClusterID, &t.Template, &t.Category, &t.Severity, &t.IsOutage, &t.Confidence,
			&t.IsKnownIssue, &t.RAGTag, &t.MatchedSignature, &t.KnownResolution, &t.MatchScore, &t.UpdatedAt); err != nil {
			return nil, fmt.Errorf("clustering: scanning cluster_triage: %w", err)
		}
		out[t.ClusterID] = t
	}
	return out, nil
}
