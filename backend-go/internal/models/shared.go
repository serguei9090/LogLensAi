package models

// Shared sub-structures referenced by multiple request models.
// Mirrors the corresponding classes in sidecar/src/models.py.
//
// NOTE on defaults: Pydantic applies field defaults (e.g. LogFilter.Operator
// == "contains", FusionSourceConfig.Enabled == true) whenever a key is absent
// from the incoming JSON. Go's encoding/json instead leaves the field at its
// zero value (""  / false / 0) when the key is absent. This package does not
// attempt to replicate Pydantic's default-substitution behavior at the
// transport layer -- callers/handlers that care about a particular default
// should apply it explicitly after decoding. This is a deliberate Phase 1
// simplification; call sites added in later phases should account for it.

// LogFilter mirrors models.py LogFilter.
type LogFilter struct {
	Field    string `json:"field"`
	Value    string `json:"value"`
	Operator string `json:"operator"` // default "contains" in Python; see note above
}

// FusionSourceConfig mirrors models.py FusionSourceConfig.
type FusionSourceConfig struct {
	SourceID     string  `json:"source_id"`
	Enabled      bool    `json:"enabled"` // default true in Python
	TzOffset     int     `json:"tz_offset"`
	CustomFormat *string `json:"custom_format,omitempty"`
	ParserConfig *string `json:"parser_config,omitempty"`
}

// TemporalOffsetEntry mirrors models.py TemporalOffsetEntry.
type TemporalOffsetEntry struct {
	SourceID      string `json:"source_id"`
	OffsetSeconds int    `json:"offset_seconds"`
}

// IngestLogEntry mirrors models.py IngestLogEntry.
type IngestLogEntry struct {
	WorkspaceID string  `json:"workspace_id"`
	SourceID    string  `json:"source_id"` // default "manual" in Python
	RawText     string  `json:"raw_text"`
	Timestamp   *string `json:"timestamp,omitempty"`
	Level       string  `json:"level"` // default "INFO" in Python
	Message     *string `json:"message,omitempty"`
}

// FacetExtractionRule mirrors models.py FacetExtractionRule.
type FacetExtractionRule struct {
	Name    string `json:"name"`
	Regex   string `json:"regex"`
	Group   int    `json:"group"`   // default 1 in Python
	Enabled bool   `json:"enabled"` // default true in Python
}

// HierarchySource mirrors models.py HierarchySource.
type HierarchySource struct {
	ID         string `json:"id"`
	Name       string `json:"name"`
	Type       string `json:"type"`
	Path       string `json:"path"`
	IsUploaded bool   `json:"is_uploaded"`
}

// HierarchyNode mirrors models.py HierarchyNode.
type HierarchyNode struct {
	ID       string            `json:"id"`
	Name     string            `json:"name"`
	Type     string            `json:"type"` // default "folder" in Python
	Children []HierarchyNode   `json:"children"`
	Sources  []HierarchySource `json:"sources"`
}

// HierarchyResponse mirrors models.py HierarchyResponse.
type HierarchyResponse struct {
	WorkspaceID string        `json:"workspace_id"`
	Root        HierarchyNode `json:"root"`
}

// GetClusteringStatusResponse mirrors models.py GetClusteringStatusResponse.
type GetClusteringStatusResponse struct {
	Mode             string `json:"mode"`
	Running          bool   `json:"running"`
	Paused           bool   `json:"paused"`
	Backlog          int    `json:"backlog"`
	ProcessedSession int    `json:"processed_session"`
}
