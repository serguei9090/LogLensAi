package models

import (
	"loglensai/backend-go/internal/ai/laya"
)

// GetLayaSettingsRequest defines the parameters for retrieving Laya AI settings and active questions.
type GetLayaSettingsRequest struct {
	WorkspaceID *string `json:"workspace_id,omitempty"`
}

// UpdateLayaSettingsRequest defines the parameters for updating Laya engine status and execution device.
type UpdateLayaSettingsRequest struct {
	Enabled     *bool   `json:"enabled,omitempty"`
	Device      *string `json:"device,omitempty"`
	WorkspaceID *string `json:"workspace_id,omitempty"`
}

// GetLayaCheckpointsRequest defines the parameters for retrieving versioned rule checkpoints.
type GetLayaCheckpointsRequest struct {
	WorkspaceID *string `json:"workspace_id,omitempty"`
}

// RollbackLayaCheckpointRequest defines the parameters for reverting active rules to a saved checkpoint.
type RollbackLayaCheckpointRequest struct {
	CheckpointID string  `json:"checkpoint_id"`
	WorkspaceID  *string `json:"workspace_id,omitempty"`
}

// SaveLayaRulesRequest defines the parameters for saving a new set of rules as a versioned checkpoint.
type SaveLayaRulesRequest struct {
	Author      string                   `json:"author"`
	Description string                   `json:"description"`
	Questions   map[string]laya.Question `json:"questions"`
	WorkspaceID *string                  `json:"workspace_id,omitempty"`
}

// TestLayaRuleRequest defines the parameters for dry-running a rule against sample state text.
type TestLayaRuleRequest struct {
	StateText    string         `json:"state_text"`
	Question     *laya.Question `json:"question,omitempty"`
	QuestionName *string        `json:"question_name,omitempty"`
	WorkspaceID  *string        `json:"workspace_id,omitempty"`
}

// GetLayaModelStatusRequest defines parameters for querying local ONNX model weight readiness.
type GetLayaModelStatusRequest struct {
	WorkspaceID *string `json:"workspace_id,omitempty"`
}

// DownloadLayaModelRequest defines parameters for requesting background download of Laya weights.
type DownloadLayaModelRequest struct {
	Force       *bool   `json:"force,omitempty"`
	WorkspaceID *string `json:"workspace_id,omitempty"`
}

// DeleteLayaModelRequest defines parameters for deleting local Laya model weights.
type DeleteLayaModelRequest struct {
	WorkspaceID *string `json:"workspace_id,omitempty"`
}
