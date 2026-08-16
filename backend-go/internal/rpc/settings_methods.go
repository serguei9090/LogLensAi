package rpc

import (
	"encoding/json"

	"loglensai/backend-go/internal/app"
	"loglensai/backend-go/internal/models"
)

// RegisterSettingsMethods wires the settings / discovery-templates /
// log-streams / temporal-offsets RPC methods against a live *app.App,
// mirroring the corresponding method_* handlers in sidecar/src/api.py:
// method_get_settings, method_update_settings,
// method_reset_workspace_settings, method_save_template,
// method_get_templates, method_delete_template, method_reset_templates,
// method_get_log_streams, method_create_log_stream,
// method_delete_log_stream, method_update_temporal_offsets, and
// method_get_temporal_offsets.
//
// Follows the same override-after-RegisterStubs pattern as
// RegisterApp/RegisterAI (see app_methods.go's doc comment): call this after
// RegisterStubs so the stub registrations for these method names exist
// first, then get replaced. Order relative to RegisterApp/RegisterAI doesn't
// matter -- all three touch disjoint method names.
//
// Four of these twelve methods (save_template, get_templates,
// delete_template, reset_templates) have no entry in Python's RPC_MODELS
// (see methods.go's paramModels doc comment, which lists them among the
// methods "absent from RPC_MODELS entirely") -- Python dispatches them with
// raw, unvalidated kwargs. Registered here with plain Register (manual
// decode, no Dispatch-level shape validation) to match. update_temporal_offsets
// is likewise absent from RPC_MODELS in Python even though its handler body
// constructs an UpdateTemporalOffsetsRequest(**kwargs) manually -- reproduced
// the same way here (manual json.Unmarshal inside the handler rather than
// through Dispatch's paramModels validation), also via plain Register.
func RegisterSettingsMethods(r *Registry, a *app.App) {
	r.RegisterWithModel("get_settings", paramModels["get_settings"], appHandler(func(req models.GetSettingsRequest) (any, *models.RPCError) {
		return a.GetSettings(req)
	}))
	r.RegisterWithModel("update_settings", paramModels["update_settings"], appHandler(func(req models.UpdateSettingsRequest) (any, *models.RPCError) {
		return a.UpdateSettings(req)
	}))
	r.RegisterWithModel("reset_workspace_settings", paramModels["reset_workspace_settings"], appHandler(func(req models.GetSettingsRequest) (any, *models.RPCError) {
		return a.ResetWorkspaceSettings(req)
	}))

	r.Register("save_template", func(params json.RawMessage) (any, *models.RPCError) {
		var req struct {
			WorkspaceID string `json:"workspace_id"`
			Name        string `json:"name"`
			ConfigJSON  string `json:"config_json"`
		}
		if err := json.Unmarshal(params, &req); err != nil {
			return nil, invalidParamsErr(err)
		}
		return a.SaveTemplate(req.WorkspaceID, req.Name, req.ConfigJSON)
	})
	r.Register("get_templates", func(params json.RawMessage) (any, *models.RPCError) {
		var req struct {
			WorkspaceID string `json:"workspace_id"`
		}
		if err := json.Unmarshal(params, &req); err != nil {
			return nil, invalidParamsErr(err)
		}
		return a.GetTemplates(req.WorkspaceID)
	})
	r.Register("delete_template", func(params json.RawMessage) (any, *models.RPCError) {
		var req struct {
			ID int `json:"id"`
		}
		if err := json.Unmarshal(params, &req); err != nil {
			return nil, invalidParamsErr(err)
		}
		return a.DeleteTemplate(req.ID)
	})
	r.Register("reset_templates", func(params json.RawMessage) (any, *models.RPCError) {
		var req struct {
			WorkspaceID string `json:"workspace_id"`
		}
		if err := json.Unmarshal(params, &req); err != nil {
			return nil, invalidParamsErr(err)
		}
		return a.ResetTemplates(req.WorkspaceID)
	})

	r.RegisterWithModel("get_log_streams", paramModels["get_log_streams"], appHandler(func(req models.GetLogStreamsRequest) (any, *models.RPCError) {
		return a.GetLogStreams(req)
	}))
	r.RegisterWithModel("create_log_stream", paramModels["create_log_stream"], appHandler(func(req models.CreateLogStreamRequest) (any, *models.RPCError) {
		return a.CreateLogStream(req)
	}))
	r.RegisterWithModel("delete_log_stream", paramModels["delete_log_stream"], appHandler(func(req models.DeleteLogStreamRequest) (any, *models.RPCError) {
		return a.DeleteLogStream(req)
	}))

	r.Register("update_temporal_offsets", func(params json.RawMessage) (any, *models.RPCError) {
		var req models.UpdateTemporalOffsetsRequest
		if err := json.Unmarshal(params, &req); err != nil {
			return nil, invalidParamsErr(err)
		}
		return a.UpdateTemporalOffsets(req)
	})
	r.RegisterWithModel("get_temporal_offsets", paramModels["get_temporal_offsets"], appHandler(func(req models.GetTemporalOffsetsRequest) (any, *models.RPCError) {
		return a.GetTemporalOffsets(req)
	}))
}
