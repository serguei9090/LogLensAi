// Assume Role: The Backend Engineer (@backend)

package db

import (
	"database/sql"
	"fmt"
)

// ClusterTriage records AI-evaluated triage dimensions (category, severity, outage indicator)
// produced by the Laya System 1 decision engine for a specific cluster template.
type ClusterTriage struct {
	WorkspaceID string  `json:"workspace_id"`
	ClusterID   string  `json:"cluster_id"`
	Template    string  `json:"template"`
	Category    string  `json:"category"`
	Severity    float64 `json:"severity"`
	IsOutage    bool    `json:"is_outage"`
	Confidence  float64 `json:"confidence"`
	UpdatedAt   string  `json:"updated_at,omitempty"`
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
			updated_at   TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
			PRIMARY KEY (workspace_id, cluster_id)
		);
	`)
	if err != nil {
		return fmt.Errorf("clustering: initializing cluster_triage table: %w", err)
	}
	return nil
}

// UpsertClusterTriage saves or updates triage dimensions for a cluster.
func (d *DB) UpsertClusterTriage(t ClusterTriage) error {
	_, err := d.Conn.Exec(`
		INSERT INTO cluster_triage (
			workspace_id, cluster_id, template, category, severity, is_outage, confidence, updated_at
		) VALUES (?, ?, ?, ?, ?, ?, ?, now())
		ON CONFLICT (workspace_id, cluster_id) DO UPDATE SET
			template = excluded.template,
			category = excluded.category,
			severity = excluded.severity,
			is_outage = excluded.is_outage,
			confidence = excluded.confidence,
			updated_at = now()
	`, t.WorkspaceID, t.ClusterID, t.Template, t.Category, t.Severity, t.IsOutage, t.Confidence)
	if err != nil {
		return fmt.Errorf("clustering: upserting cluster_triage %s/%s: %w", t.WorkspaceID, t.ClusterID, err)
	}
	return nil
}

// GetClusterTriage retrieves triage attributes for a single cluster.
func (d *DB) GetClusterTriage(workspaceID, clusterID string) (*ClusterTriage, error) {
	row := d.Conn.QueryRow(`
		SELECT workspace_id, cluster_id, template, category, severity, is_outage, confidence, CAST(updated_at AS VARCHAR)
		FROM cluster_triage
		WHERE workspace_id = ? AND cluster_id = ?
	`, workspaceID, clusterID)

	var t ClusterTriage
	if err := row.Scan(&t.WorkspaceID, &t.ClusterID, &t.Template, &t.Category, &t.Severity, &t.IsOutage, &t.Confidence, &t.UpdatedAt); err != nil {
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
		SELECT workspace_id, cluster_id, template, category, severity, is_outage, confidence, CAST(updated_at AS VARCHAR)
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
		if err := rows.Scan(&t.WorkspaceID, &t.ClusterID, &t.Template, &t.Category, &t.Severity, &t.IsOutage, &t.Confidence, &t.UpdatedAt); err != nil {
			return nil, fmt.Errorf("clustering: scanning cluster_triage: %w", err)
		}
		out[t.ClusterID] = t
	}
	return out, nil
}
