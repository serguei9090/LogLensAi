// Assume Role: The Backend Engineer (@backend)

package app

import (
	"context"
	"fmt"

	"loglensai/backend-go/internal/ai/laya"
	"loglensai/backend-go/internal/models"
)

// GetLayaSettings implements the get_laya_settings JSON-RPC 2.0 method,
// returning runtime settings and the current active questions map.
func (a *App) GetLayaSettings(req models.GetLayaSettingsRequest) (any, *models.RPCError) {
	if a.LayaManager == nil {
		return nil, &models.RPCError{Code: errInternal, Message: "laya rule manager not initialized"}
	}
	return a.LayaManager.GetSettings(), nil
}

// UpdateLayaSettings implements the update_laya_settings JSON-RPC 2.0 method,
// updating execution status (enabled/disabled) and target device ("cpu" or "gpu").
func (a *App) UpdateLayaSettings(req models.UpdateLayaSettingsRequest) (any, *models.RPCError) {
	if a.LayaManager == nil {
		return nil, &models.RPCError{Code: errInternal, Message: "laya rule manager not initialized"}
	}

	curr := a.LayaManager.GetSettings()
	enabled := curr.Enabled
	if req.Enabled != nil {
		enabled = *req.Enabled
	}

	device := curr.Device
	if req.Device != nil {
		device = *req.Device
	}

	if device != "cpu" && device != "gpu" {
		return nil, &models.RPCError{
			Code:    errInvalidParams,
			Message: fmt.Sprintf("invalid device %q: must be 'cpu' or 'gpu'", device),
		}
	}

	if err := a.LayaManager.UpdateSettings(enabled, device); err != nil {
		return nil, &models.RPCError{Code: errInternal, Message: err.Error()}
	}

	if a.LayaEngine != nil {
		_ = a.LayaEngine.SetDevice(device)
	}

	return map[string]any{
		"status":  "success",
		"enabled": enabled,
		"device":  device,
	}, nil
}

// GetLayaCheckpoints implements the get_laya_checkpoints JSON-RPC 2.0 method,
// returning all versioned rule snapshots stored in the persistence file.
func (a *App) GetLayaCheckpoints(req models.GetLayaCheckpointsRequest) (any, *models.RPCError) {
	if a.LayaManager == nil {
		return nil, &models.RPCError{Code: errInternal, Message: "laya rule manager not initialized"}
	}
	return a.LayaManager.GetCheckpoints(), nil
}

// RollbackLayaCheckpoint implements the rollback_laya_checkpoint JSON-RPC 2.0 method,
// restoring an existing checkpoint as the active rule set.
func (a *App) RollbackLayaCheckpoint(req models.RollbackLayaCheckpointRequest) (any, *models.RPCError) {
	if a.LayaManager == nil {
		return nil, &models.RPCError{Code: errInternal, Message: "laya rule manager not initialized"}
	}
	if req.CheckpointID == "" {
		return nil, &models.RPCError{Code: errInvalidParams, Message: "checkpoint_id cannot be empty"}
	}

	if err := a.LayaManager.RollbackToCheckpoint(req.CheckpointID); err != nil {
		return nil, &models.RPCError{Code: errInternal, Message: err.Error()}
	}

	return map[string]any{
		"status":            "success",
		"active_checkpoint": req.CheckpointID,
	}, nil
}

// SaveLayaRules implements the save_laya_rules JSON-RPC 2.0 method,
// creating a new checkpoint with the provided rules and making it active.
func (a *App) SaveLayaRules(req models.SaveLayaRulesRequest) (any, *models.RPCError) {
	if a.LayaManager == nil {
		return nil, &models.RPCError{Code: errInternal, Message: "laya rule manager not initialized"}
	}
	if len(req.Questions) == 0 {
		return nil, &models.RPCError{Code: errInvalidParams, Message: "questions cannot be empty"}
	}

	author := req.Author
	if author == "" {
		author = "User"
	}

	cp, err := a.LayaManager.SaveCheckpoint(author, req.Description, req.Questions)
	if err != nil {
		return nil, &models.RPCError{Code: errInternal, Message: err.Error()}
	}

	return cp, nil
}

// TestLayaRule implements the test_laya_rule JSON-RPC 2.0 method,
// running dry-run inference against sample text using either an inline question or an active named rule.
func (a *App) TestLayaRule(req models.TestLayaRuleRequest) (any, *models.RPCError) {
	if a.LayaEngine == nil {
		return nil, &models.RPCError{Code: errInternal, Message: "laya engine not initialized"}
	}
	if a.LayaManager == nil {
		return nil, &models.RPCError{Code: errInternal, Message: "laya rule manager not initialized"}
	}

	var q laya.Question
	if req.Question != nil {
		q = *req.Question
	} else if req.QuestionName != nil {
		activeQuestions := a.LayaManager.GetActiveQuestions()
		found, exists := activeQuestions[*req.QuestionName]
		if !exists {
			return nil, &models.RPCError{
				Code:    errInvalidParams,
				Message: fmt.Sprintf("question %q not found in active rules", *req.QuestionName),
			}
		}
		q = found
	} else {
		return nil, &models.RPCError{
			Code:    errInvalidParams,
			Message: "either question or question_name must be provided",
		}
	}

	result, err := a.LayaEngine.Predict(context.Background(), q, req.StateText)
	if err != nil {
		return nil, &models.RPCError{Code: errInternal, Message: err.Error()}
	}

	return result, nil
}
