// Assume Role: The Backend Engineer (@backend)

package app

import (
	"path/filepath"
	"testing"

	"loglensai/backend-go/internal/ai/laya"
	"loglensai/backend-go/internal/models"
)

func newLayaTestApp(t *testing.T) *App {
	t.Helper()
	tmpDir := t.TempDir()
	dbFile := filepath.Join(tmpDir, "test.duckdb")
	a, err := NewApp(dbFile)
	if err != nil {
		t.Fatalf("NewApp failed: %v", err)
	}
	t.Cleanup(func() { _ = a.Close() })
	return a
}

func TestGetLayaSettings(t *testing.T) {
	a := newLayaTestApp(t)

	// 1. Success case: baseline default settings
	res, rpcErr := a.GetLayaSettings(models.GetLayaSettingsRequest{})
	if rpcErr != nil {
		t.Fatalf("unexpected RPC error: %+v", rpcErr)
	}
	settings, ok := res.(laya.LayaSettings)
	if !ok {
		t.Fatalf("expected laya.LayaSettings, got %T", res)
	}
	if settings.Enabled {
		t.Errorf("expected Enabled=false by default, got true")
	}
	if settings.Device != "cpu" {
		t.Errorf("expected Device='cpu' by default, got %q", settings.Device)
	}
	if settings.ActiveCheckpoint != "chk_init" {
		t.Errorf("expected ActiveCheckpoint='chk_init', got %q", settings.ActiveCheckpoint)
	}
	if len(settings.Questions) == 0 {
		t.Fatalf("expected baseline questions, got empty map")
	}
	if _, ok := settings.Questions["tool_intent"]; !ok {
		t.Errorf("expected 'tool_intent' in questions")
	}
	if _, ok := settings.Questions["severity"]; !ok {
		t.Errorf("expected 'severity' in questions")
	}

	// 2. Error guard: uninitialized manager
	uninitApp := &App{}
	_, errGuard := uninitApp.GetLayaSettings(models.GetLayaSettingsRequest{})
	if errGuard == nil || errGuard.Code != errInternal {
		t.Fatalf("expected errInternal for uninitialized manager, got %+v", errGuard)
	}
}

func TestUpdateLayaSettings(t *testing.T) {
	a := newLayaTestApp(t)

	// 1. Update both enabled and device
	enabledTrue := true
	deviceGPU := "gpu"
	res, rpcErr := a.UpdateLayaSettings(models.UpdateLayaSettingsRequest{
		Enabled: &enabledTrue,
		Device:  &deviceGPU,
	})
	if rpcErr != nil {
		t.Fatalf("unexpected RPC error: %+v", rpcErr)
	}
	settings, ok := res.(laya.LayaSettings)
	if !ok {
		t.Fatalf("expected laya.LayaSettings, got %T", res)
	}
	if !settings.Enabled || settings.Device != "gpu" {
		t.Errorf("unexpected update result: %+v", settings)
	}

	// Verify persistence in GetLayaSettings
	getRes, _ := a.GetLayaSettings(models.GetLayaSettingsRequest{})
	persisted := getRes.(laya.LayaSettings)
	if !persisted.Enabled || persisted.Device != "gpu" {
		t.Errorf("settings not updated: enabled=%v, device=%s", persisted.Enabled, persisted.Device)
	}

	// 2. Partial update: update only enabled back to false
	enabledFalse := false
	resPartial, rpcErr := a.UpdateLayaSettings(models.UpdateLayaSettingsRequest{
		Enabled: &enabledFalse,
	})
	if rpcErr != nil {
		t.Fatalf("unexpected RPC error: %+v", rpcErr)
	}
	partialSettings := resPartial.(laya.LayaSettings)
	if partialSettings.Enabled != false || partialSettings.Device != "gpu" {
		t.Errorf("unexpected partial update result: %+v", partialSettings)
	}

	// 3. Error case: invalid device
	invalidDev := "quantum"
	_, errDev := a.UpdateLayaSettings(models.UpdateLayaSettingsRequest{
		Device: &invalidDev,
	})
	if errDev == nil || errDev.Code != errInvalidParams {
		t.Fatalf("expected errInvalidParams for invalid device, got %+v", errDev)
	}

	// 4. Error guard: uninitialized manager
	uninitApp := &App{}
	_, errGuard := uninitApp.UpdateLayaSettings(models.UpdateLayaSettingsRequest{})
	if errGuard == nil || errGuard.Code != errInternal {
		t.Fatalf("expected errInternal for uninitialized manager, got %+v", errGuard)
	}
}

func TestGetLayaCheckpoints(t *testing.T) {
	a := newLayaTestApp(t)

	// 1. Success case: initial checkpoint list
	res, rpcErr := a.GetLayaCheckpoints(models.GetLayaCheckpointsRequest{})
	if rpcErr != nil {
		t.Fatalf("unexpected RPC error: %+v", rpcErr)
	}
	checkpoints, ok := res.([]laya.Checkpoint)
	if !ok {
		t.Fatalf("expected []laya.Checkpoint, got %T", res)
	}
	if len(checkpoints) != 1 {
		t.Fatalf("expected 1 initial checkpoint, got %d", len(checkpoints))
	}
	initCP := checkpoints[0]
	if initCP.ID != "chk_init" {
		t.Errorf("expected ID='chk_init', got %q", initCP.ID)
	}
	if initCP.Author != "System Defaults" {
		t.Errorf("expected Author='System Defaults', got %q", initCP.Author)
	}
	if len(initCP.Questions) == 0 {
		t.Errorf("expected checkpoint questions to be populated")
	}

	// 2. Error guard: uninitialized manager
	uninitApp := &App{}
	_, errGuard := uninitApp.GetLayaCheckpoints(models.GetLayaCheckpointsRequest{})
	if errGuard == nil || errGuard.Code != errInternal {
		t.Fatalf("expected errInternal for uninitialized manager, got %+v", errGuard)
	}
}

func TestSaveLayaRulesAndRollback(t *testing.T) {
	a := newLayaTestApp(t)

	customQuestions := map[string]laya.Question{
		"custom_alert": {
			Type:         laya.QuestionTypeNoul,
			Instructions: "Is this event a critical infrastructure alert?",
		},
		"log_component": {
			Type:         laya.QuestionTypeChoice,
			Instructions: "Identify the service component generating this log line.",
			Options:      []string{"ingress", "storage", "compute"},
		},
	}

	// 1. Save new checkpoint
	saveRes, rpcErr := a.SaveLayaRules(models.SaveLayaRulesRequest{
		Author:      "DevOps Lead",
		Description: "Production v2 alert rules",
		Questions:   customQuestions,
	})
	if rpcErr != nil {
		t.Fatalf("unexpected RPC error: %+v", rpcErr)
	}
	newCP, ok := saveRes.(*laya.Checkpoint)
	if !ok {
		t.Fatalf("expected *laya.Checkpoint, got %T", saveRes)
	}
	if newCP.Author != "DevOps Lead" || newCP.Description != "Production v2 alert rules" {
		t.Errorf("unexpected checkpoint metadata: %+v", newCP)
	}
	if len(newCP.Questions) != 2 {
		t.Errorf("expected 2 questions, got %d", len(newCP.Questions))
	}

	// Verify it became active
	getRes, _ := a.GetLayaSettings(models.GetLayaSettingsRequest{})
	settings := getRes.(laya.LayaSettings)
	if settings.ActiveCheckpoint != newCP.ID {
		t.Errorf("expected active checkpoint %q, got %q", newCP.ID, settings.ActiveCheckpoint)
	}
	if _, ok := settings.Questions["custom_alert"]; !ok {
		t.Errorf("expected 'custom_alert' in active questions")
	}

	// Verify checkpoints list now has 2 entries
	cpsRes, _ := a.GetLayaCheckpoints(models.GetLayaCheckpointsRequest{})
	cps := cpsRes.([]laya.Checkpoint)
	if len(cps) != 2 {
		t.Errorf("expected 2 checkpoints, got %d", len(cps))
	}

	// 2. Rollback to initial checkpoint
	rbRes, rpcErr := a.RollbackLayaCheckpoint(models.RollbackLayaCheckpointRequest{
		CheckpointID: "chk_init",
	})
	if rpcErr != nil {
		t.Fatalf("unexpected rollback error: %+v", rpcErr)
	}
	rbMap := rbRes.(map[string]any)
	if rbMap["status"] != "success" || rbMap["active_checkpoint"] != "chk_init" {
		t.Errorf("unexpected rollback result: %+v", rbMap)
	}

	// Verify active checkpoint reverted
	getResAfter, _ := a.GetLayaSettings(models.GetLayaSettingsRequest{})
	settingsAfter := getResAfter.(laya.LayaSettings)
	if settingsAfter.ActiveCheckpoint != "chk_init" {
		t.Errorf("expected active checkpoint 'chk_init', got %q", settingsAfter.ActiveCheckpoint)
	}
	if _, ok := settingsAfter.Questions["tool_intent"]; !ok {
		t.Errorf("expected 'tool_intent' restored in active questions")
	}

	// 3. Save validation errors
	_, errEmptyQ := a.SaveLayaRules(models.SaveLayaRulesRequest{
		Questions: nil,
	})
	if errEmptyQ == nil || errEmptyQ.Code != errInvalidParams {
		t.Fatalf("expected errInvalidParams for empty questions, got %+v", errEmptyQ)
	}

	// Choice without options validation
	_, errInvalidQ := a.SaveLayaRules(models.SaveLayaRulesRequest{
		Questions: map[string]laya.Question{
			"bad_choice": {
				Type:         laya.QuestionTypeChoice,
				Instructions: "Missing options",
				Options:      nil,
			},
		},
	})
	if errInvalidQ == nil || errInvalidQ.Code != errInternal {
		t.Fatalf("expected errInternal for invalid question options, got %+v", errInvalidQ)
	}

	// 4. Rollback validation errors
	_, errEmptyID := a.RollbackLayaCheckpoint(models.RollbackLayaCheckpointRequest{
		CheckpointID: "",
	})
	if errEmptyID == nil || errEmptyID.Code != errInvalidParams {
		t.Fatalf("expected errInvalidParams for empty checkpoint ID, got %+v", errEmptyID)
	}

	_, errNotFound := a.RollbackLayaCheckpoint(models.RollbackLayaCheckpointRequest{
		CheckpointID: "chk_nonexistent_xyz",
	})
	if errNotFound == nil || errNotFound.Code != errInternal {
		t.Fatalf("expected errInternal for non-existent checkpoint, got %+v", errNotFound)
	}

	// 5. Error guard: uninitialized manager
	uninitApp := &App{}
	_, errSaveGuard := uninitApp.SaveLayaRules(models.SaveLayaRulesRequest{Questions: customQuestions})
	if errSaveGuard == nil || errSaveGuard.Code != errInternal {
		t.Fatalf("expected errInternal for uninitialized manager, got %+v", errSaveGuard)
	}
	_, errRbGuard := uninitApp.RollbackLayaCheckpoint(models.RollbackLayaCheckpointRequest{CheckpointID: "chk_init"})
	if errRbGuard == nil || errRbGuard.Code != errInternal {
		t.Fatalf("expected errInternal for uninitialized manager, got %+v", errRbGuard)
	}
}

func TestTestLayaRule(t *testing.T) {
	a := newLayaTestApp(t)

	// 1. Predict using inline question
	inlineQ := &laya.Question{
		Type:         laya.QuestionTypeChoice,
		Instructions: "Identify the relevant subsystem",
		Options:      []string{"database", "network", "auth"},
	}
	resInline, rpcErr := a.TestLayaRule(models.TestLayaRuleRequest{
		StateText: "PostgreSQL connection refused on port 5432",
		Question:  inlineQ,
	})
	if rpcErr != nil {
		t.Fatalf("unexpected RPC error for inline question: %+v", rpcErr)
	}
	decInline, ok := resInline.(*laya.DecisionResult)
	if !ok {
		t.Fatalf("expected *laya.DecisionResult, got %T", resInline)
	}
	if decInline.SelectedLabel != "database" {
		t.Errorf("expected SelectedLabel='database', got %q", decInline.SelectedLabel)
	}
	if decInline.Confidence <= 0 {
		t.Errorf("expected positive confidence, got %f", decInline.Confidence)
	}

	// 2. Predict using active named question ("severity")
	qNameSeverity := "severity"
	resNamed, rpcErr := a.TestLayaRule(models.TestLayaRuleRequest{
		StateText:    "FATAL PANIC: memory segment corruption",
		QuestionName: &qNameSeverity,
	})
	if rpcErr != nil {
		t.Fatalf("unexpected RPC error for named question: %+v", rpcErr)
	}
	decNamed, ok := resNamed.(*laya.DecisionResult)
	if !ok {
		t.Fatalf("expected *laya.DecisionResult, got %T", resNamed)
	}
	if decNamed.SelectedScore < 4.0 {
		t.Errorf("expected severity score >= 4.0 for fatal panic, got %f", decNamed.SelectedScore)
	}

	// 3. Predict using active named question ("is_outage")
	qNameOutage := "is_outage"
	resOutage, rpcErr := a.TestLayaRule(models.TestLayaRuleRequest{
		StateText:    "Emergency: site is down, major customer-facing outage incident",
		QuestionName: &qNameOutage,
	})
	if rpcErr != nil {
		t.Fatalf("unexpected RPC error for outage question: %+v", rpcErr)
	}
	decOutage := resOutage.(*laya.DecisionResult)
	if decOutage.SelectedLabel != "true" {
		t.Errorf("expected outage label='true', got %q", decOutage.SelectedLabel)
	}

	// 4. Error case: neither question nor question_name provided
	_, errMissing := a.TestLayaRule(models.TestLayaRuleRequest{
		StateText: "Some log text",
	})
	if errMissing == nil || errMissing.Code != errInvalidParams {
		t.Fatalf("expected errInvalidParams when question is missing, got %+v", errMissing)
	}

	// 5. Error case: unknown question_name
	unknownName := "nonexistent_rule_abc"
	_, errUnknown := a.TestLayaRule(models.TestLayaRuleRequest{
		StateText:    "Some log text",
		QuestionName: &unknownName,
	})
	if errUnknown == nil || errUnknown.Code != errInvalidParams {
		t.Fatalf("expected errInvalidParams for unknown question_name, got %+v", errUnknown)
	}

	// 6. Error guard: uninitialized engine or manager
	uninitApp := &App{}
	_, errGuard := uninitApp.TestLayaRule(models.TestLayaRuleRequest{
		StateText: "test",
		Question:  inlineQ,
	})
	if errGuard == nil || errGuard.Code != errInternal {
		t.Fatalf("expected errInternal for uninitialized engine, got %+v", errGuard)
	}
}

func TestGetLayaModelStatus_And_Download(t *testing.T) {
	a := newLayaTestApp(t)

	// 1. Initial status
	res, rpcErr := a.GetLayaModelStatus(models.GetLayaModelStatusRequest{})
	if rpcErr != nil {
		t.Fatalf("unexpected RPC error: %+v", rpcErr)
	}
	st, ok := res.(laya.ModelStatus)
	if !ok {
		t.Fatalf("expected laya.ModelStatus, got %T", res)
	}
	if st.State != laya.ModelStateIdle {
		t.Errorf("expected state %s, got %s", laya.ModelStateIdle, st.State)
	}

	// 2. Download trigger
	dlRes, dlErr := a.DownloadLayaModel(models.DownloadLayaModelRequest{})
	if dlErr != nil {
		t.Fatalf("unexpected RPC error on DownloadLayaModel: %+v", dlErr)
	}
	dlSt, ok := dlRes.(laya.ModelStatus)
	if !ok {
		t.Fatalf("expected laya.ModelStatus, got %T", dlRes)
	}
	if dlSt.State != laya.ModelStateDownloading && dlSt.State != laya.ModelStateReady {
		t.Errorf("expected state downloading or ready, got %s", dlSt.State)
	}
	a.LayaModels.CancelDownload()

	// 3. Error guard: uninitialized model manager
	uninitApp := &App{}
	_, errGuard := uninitApp.DownloadLayaModel(models.DownloadLayaModelRequest{})
	if errGuard == nil || errGuard.Code != errInternal {
		t.Fatalf("expected errInternal for uninitialized model manager, got %+v", errGuard)
	}
}

