// Assume Role: The Backend Engineer (@backend)

package laya

import (
	"os"
	"path/filepath"
	"reflect"
	"sync"
	"testing"
)

func TestRuleManager_InitDefaultRules(t *testing.T) {
	tempDir := t.TempDir()
	configPath := filepath.Join(tempDir, "laya_rules.json")

	rm, err := NewRuleManager(configPath)
	if err != nil {
		t.Fatalf("expected NewRuleManager to succeed, got: %v", err)
	}

	// Verify file was written to disk
	if _, err := os.Stat(configPath); err != nil {
		t.Fatalf("expected config file to exist at %s: %v", configPath, err)
	}

	// Verify settings
	settings := rm.GetSettings()
	if settings.Enabled != false {
		t.Errorf("expected Enabled=false, got %v", settings.Enabled)
	}
	if settings.Device != "cpu" {
		t.Errorf("expected Device='cpu', got %q", settings.Device)
	}
	if settings.ActiveCheckpoint != "chk_init" {
		t.Errorf("expected ActiveCheckpoint='chk_init', got %q", settings.ActiveCheckpoint)
	}

	// Verify checkpoints
	cps := rm.GetCheckpoints()
	if len(cps) != 1 {
		t.Fatalf("expected 1 checkpoint, got %d", len(cps))
	}
	if cps[0].ID != "chk_init" {
		t.Errorf("expected checkpoint ID='chk_init', got %q", cps[0].ID)
	}
	if cps[0].Author != "System Defaults" {
		t.Errorf("expected checkpoint Author='System Defaults', got %q", cps[0].Author)
	}

	// Verify baseline questions
	q := rm.GetActiveQuestions()
	expectedNames := []string{"tool_intent", "severity", "category", "is_outage"}
	for _, name := range expectedNames {
		if _, ok := q[name]; !ok {
			t.Errorf("expected baseline question %q to exist", name)
		}
	}

	// tool_intent details
	ti := q["tool_intent"]
	if ti.Type != QuestionTypeChoice {
		t.Errorf("expected tool_intent type 'choice', got %q", ti.Type)
	}
	expectedTools := []string{"search_logs", "get_clusters", "search_memory", "get_facets", "conversational_qa"}
	if !reflect.DeepEqual(ti.Options, expectedTools) {
		t.Errorf("tool_intent options mismatch: got %v, want %v", ti.Options, expectedTools)
	}

	// severity details
	sev := q["severity"]
	if sev.Type != QuestionTypeScore {
		t.Errorf("expected severity type 'score', got %q", sev.Type)
	}
	expectedRubric := []int{1, 2, 3, 4, 5}
	if !reflect.DeepEqual(sev.Rubric, expectedRubric) {
		t.Errorf("severity rubric mismatch: got %v, want %v", sev.Rubric, expectedRubric)
	}

	// category details
	cat := q["category"]
	if cat.Type != QuestionTypeChoice {
		t.Errorf("expected category type 'choice', got %q", cat.Type)
	}
	expectedCats := []string{"database", "network", "auth", "disk_io", "application", "third_party"}
	if !reflect.DeepEqual(cat.Options, expectedCats) {
		t.Errorf("category options mismatch: got %v, want %v", cat.Options, expectedCats)
	}

	// is_outage details
	outage := q["is_outage"]
	if outage.Type != QuestionTypeNoul {
		t.Errorf("expected is_outage type 'noul', got %q", outage.Type)
	}
}

func TestRuleManager_SaveCheckpoint(t *testing.T) {
	tempDir := t.TempDir()
	configPath := filepath.Join(tempDir, "laya_rules.json")

	rm, err := NewRuleManager(configPath)
	if err != nil {
		t.Fatalf("NewRuleManager failed: %v", err)
	}

	customQuestions := map[string]Question{
		"custom_intent": {
			Type:         QuestionTypeChoice,
			Instructions: "Test intent",
			Options:      []string{"opt1", "opt2"},
		},
		"test_score": {
			Type:         QuestionTypeScore,
			Instructions: "Test score",
			Rubric:       []int{1, 2, 3},
		},
		"has_bug": {
			Type:         QuestionTypeNoul,
			Instructions: "Is there a bug?",
		},
	}

	cp, err := rm.SaveCheckpoint("Tester", "Add custom intent", customQuestions)
	if err != nil {
		t.Fatalf("SaveCheckpoint failed: %v", err)
	}

	if cp.ID == "" || cp.ID == "chk_init" {
		t.Errorf("unexpected checkpoint ID: %q", cp.ID)
	}
	if cp.Author != "Tester" {
		t.Errorf("expected Author 'Tester', got %q", cp.Author)
	}
	if cp.Description != "Add custom intent" {
		t.Errorf("expected Description 'Add custom intent', got %q", cp.Description)
	}

	// Verify active checkpoint updated
	settings := rm.GetSettings()
	if settings.ActiveCheckpoint != cp.ID {
		t.Errorf("expected active checkpoint %q, got %q", cp.ID, settings.ActiveCheckpoint)
	}

	// Verify active questions returned
	activeQ := rm.GetActiveQuestions()
	if len(activeQ) != 3 {
		t.Fatalf("expected 3 active questions, got %d", len(activeQ))
	}
	if _, ok := activeQ["custom_intent"]; !ok {
		t.Errorf("custom_intent missing from active questions")
	}

	// Verify checkpoints history count
	allCPs := rm.GetCheckpoints()
	if len(allCPs) != 2 {
		t.Fatalf("expected 2 checkpoints in history, got %d", len(allCPs))
	}
	if allCPs[1].ID != cp.ID {
		t.Errorf("expected last checkpoint to be %q, got %q", cp.ID, allCPs[1].ID)
	}
}

func TestRuleManager_RollbackToCheckpoint(t *testing.T) {
	tempDir := t.TempDir()
	configPath := filepath.Join(tempDir, "laya_rules.json")

	rm, err := NewRuleManager(configPath)
	if err != nil {
		t.Fatalf("NewRuleManager failed: %v", err)
	}

	customQuestions := map[string]Question{
		"new_q": {
			Type:         QuestionTypeNoul,
			Instructions: "New question prompt",
		},
	}

	newCP, err := rm.SaveCheckpoint("User2", "Second checkpoint", customQuestions)
	if err != nil {
		t.Fatalf("SaveCheckpoint failed: %v", err)
	}

	if rm.GetSettings().ActiveCheckpoint != newCP.ID {
		t.Fatalf("expected active checkpoint to be %q", newCP.ID)
	}

	// Rollback to chk_init
	if err := rm.RollbackToCheckpoint("chk_init"); err != nil {
		t.Fatalf("RollbackToCheckpoint failed: %v", err)
	}

	if rm.GetSettings().ActiveCheckpoint != "chk_init" {
		t.Errorf("expected ActiveCheckpoint 'chk_init', got %q", rm.GetSettings().ActiveCheckpoint)
	}

	activeQ := rm.GetActiveQuestions()
	if _, ok := activeQ["tool_intent"]; !ok {
		t.Errorf("expected tool_intent from baseline rules to be active after rollback")
	}
	if _, ok := activeQ["new_q"]; ok {
		t.Errorf("did not expect new_q to be active after rollback")
	}

	// Rollback to non-existent checkpoint
	if err := rm.RollbackToCheckpoint("non_existent_id"); err == nil {
		t.Errorf("expected error rolling back to non-existent checkpoint, got nil")
	}
}

func TestRuleManager_UpdateSettings(t *testing.T) {
	tempDir := t.TempDir()
	configPath := filepath.Join(tempDir, "laya_rules.json")

	rm, err := NewRuleManager(configPath)
	if err != nil {
		t.Fatalf("NewRuleManager failed: %v", err)
	}

	// Update to GPU and Enabled=true
	if err := rm.UpdateSettings(true, "gpu"); err != nil {
		t.Fatalf("UpdateSettings failed: %v", err)
	}

	s := rm.GetSettings()
	if !s.Enabled {
		t.Errorf("expected Enabled=true, got %v", s.Enabled)
	}
	if s.Device != "gpu" {
		t.Errorf("expected Device='gpu', got %q", s.Device)
	}

	// Update to CPU and Enabled=false
	if err := rm.UpdateSettings(false, "cpu"); err != nil {
		t.Fatalf("UpdateSettings failed: %v", err)
	}
	s = rm.GetSettings()
	if s.Enabled {
		t.Errorf("expected Enabled=false, got %v", s.Enabled)
	}
	if s.Device != "cpu" {
		t.Errorf("expected Device='cpu', got %q", s.Device)
	}

	// Invalid device
	if err := rm.UpdateSettings(true, "tpu"); err == nil {
		t.Errorf("expected error with invalid device 'tpu', got nil")
	}
	// Settings should remain unchanged
	s = rm.GetSettings()
	if s.Device != "cpu" {
		t.Errorf("expected Device to remain 'cpu', got %q", s.Device)
	}

	// Empty device should default to cpu
	if err := rm.UpdateSettings(true, ""); err != nil {
		t.Fatalf("expected empty device to default to cpu without error: %v", err)
	}
	s = rm.GetSettings()
	if s.Device != "cpu" {
		t.Errorf("expected Device to default to 'cpu', got %q", s.Device)
	}
}

func TestRuleManager_PersistenceReload(t *testing.T) {
	tempDir := t.TempDir()
	configPath := filepath.Join(tempDir, "sub", "dir", "laya_rules.json")

	// Instance 1: write and modify
	rm1, err := NewRuleManager(configPath)
	if err != nil {
		t.Fatalf("NewRuleManager 1 failed: %v", err)
	}

	if err := rm1.UpdateSettings(true, "gpu"); err != nil {
		t.Fatalf("UpdateSettings failed: %v", err)
	}

	customQuestions := map[string]Question{
		"persisted_q": {
			Type:         QuestionTypeChoice,
			Instructions: "Persisted question",
			Options:      []string{"yes", "no"},
		},
	}
	savedCP, err := rm1.SaveCheckpoint("Auditor", "Persistence test", customQuestions)
	if err != nil {
		t.Fatalf("SaveCheckpoint failed: %v", err)
	}

	// Instance 2: reload from the same file path
	rm2, err := NewRuleManager(configPath)
	if err != nil {
		t.Fatalf("NewRuleManager 2 failed: %v", err)
	}

	s2 := rm2.GetSettings()
	if !s2.Enabled {
		t.Errorf("rm2 expected Enabled=true, got %v", s2.Enabled)
	}
	if s2.Device != "gpu" {
		t.Errorf("rm2 expected Device='gpu', got %q", s2.Device)
	}
	if s2.ActiveCheckpoint != savedCP.ID {
		t.Errorf("rm2 expected ActiveCheckpoint=%q, got %q", savedCP.ID, s2.ActiveCheckpoint)
	}

	activeQ2 := rm2.GetActiveQuestions()
	if q, ok := activeQ2["persisted_q"]; !ok {
		t.Errorf("rm2 expected persisted_q in active questions")
	} else if len(q.Options) != 2 || q.Options[0] != "yes" {
		t.Errorf("rm2 options mismatch: %v", q.Options)
	}

	cps2 := rm2.GetCheckpoints()
	if len(cps2) != 2 {
		t.Fatalf("rm2 expected 2 checkpoints, got %d", len(cps2))
	}
	if cps2[1].ID != savedCP.ID {
		t.Errorf("rm2 checkpoint ID mismatch: got %q, want %q", cps2[1].ID, savedCP.ID)
	}
}

func TestRuleManager_Validation(t *testing.T) {
	tempDir := t.TempDir()
	configPath := filepath.Join(tempDir, "laya_rules.json")

	rm, err := NewRuleManager(configPath)
	if err != nil {
		t.Fatalf("NewRuleManager failed: %v", err)
	}

	// Empty questions map
	if _, err := rm.SaveCheckpoint("Tester", "Empty", nil); err == nil {
		t.Errorf("expected error with nil questions, got nil")
	}
	if _, err := rm.SaveCheckpoint("Tester", "Empty", map[string]Question{}); err == nil {
		t.Errorf("expected error with empty questions, got nil")
	}

	// Choice without options
	invalidChoice := map[string]Question{
		"bad_choice": {
			Type:         QuestionTypeChoice,
			Instructions: "Bad",
			Options:      nil,
		},
	}
	if _, err := rm.SaveCheckpoint("Tester", "Bad choice", invalidChoice); err == nil {
		t.Errorf("expected error for choice without options, got nil")
	}

	// Score without rubric
	invalidScore := map[string]Question{
		"bad_score": {
			Type:         QuestionTypeScore,
			Instructions: "Bad",
			Rubric:       nil,
		},
	}
	if _, err := rm.SaveCheckpoint("Tester", "Bad score", invalidScore); err == nil {
		t.Errorf("expected error for score without rubric, got nil")
	}

	// Invalid question type
	invalidType := map[string]Question{
		"bad_type": {
			Type:         QuestionType("unknown"),
			Instructions: "Bad",
		},
	}
	if _, err := rm.SaveCheckpoint("Tester", "Bad type", invalidType); err == nil {
		t.Errorf("expected error for unknown question type, got nil")
	}
}

func TestRuleManager_Concurrency(t *testing.T) {
	tempDir := t.TempDir()
	configPath := filepath.Join(tempDir, "laya_rules.json")

	rm, err := NewRuleManager(configPath)
	if err != nil {
		t.Fatalf("NewRuleManager failed: %v", err)
	}

	var wg sync.WaitGroup
	workers := 10
	iterations := 25

	for w := 0; w < workers; w++ {
		wg.Add(1)
		go func(workerID int) {
			defer wg.Done()
			for i := 0; i < iterations; i++ {
				// Concurrent reads
				_ = rm.GetSettings()
				_ = rm.GetActiveQuestions()
				_ = rm.GetCheckpoints()

				// Concurrent updates
				_ = rm.UpdateSettings(workerID%2 == 0, "cpu")

				// Concurrent saves
				customQ := map[string]Question{
					"concurrent_q": {
						Type:         QuestionTypeNoul,
						Instructions: "Concurrent test",
					},
				}
				cp, err := rm.SaveCheckpoint("Worker", "Concurrent save", customQ)
				if err == nil && cp != nil {
					_ = rm.RollbackToCheckpoint("chk_init")
				}
			}
		}(w)
	}

	wg.Wait()

	// Ensure manager state is still consistent
	settings := rm.GetSettings()
	if settings.Device != "cpu" && settings.Device != "gpu" {
		t.Errorf("corrupted device setting: %q", settings.Device)
	}
	if len(rm.GetCheckpoints()) < 1 {
		t.Errorf("checkpoints should have at least the initial checkpoint")
	}
}
