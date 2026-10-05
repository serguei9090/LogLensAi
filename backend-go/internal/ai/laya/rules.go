// Assume Role: The Backend Engineer (@backend)

package laya

import (
	"encoding/json"
	"fmt"
	"os"
	"path/filepath"
	"sync"
	"time"

	"github.com/google/uuid"
)

// RuleManager manages thread-safe in-memory state and atomic disk persistence
// for Laya AI rules, checkpoints, and execution settings.
type RuleManager struct {
	mu         sync.RWMutex
	configPath string
	config     RuleConfig
}

// DefaultBaselineQuestions returns the standard out-of-the-box rule set for log triage and routing.
func DefaultBaselineQuestions() map[string]Question {
	return map[string]Question{
		"tool_intent": {
			Type:         QuestionTypeChoice,
			Instructions: "Classify the user intent into the appropriate log analysis tool or conversation.",
			Options: []string{
				"search_logs",
				"get_clusters",
				"search_memory",
				"get_facets",
				"conversational_qa",
			},
		},
		"severity": {
			Type:         QuestionTypeScore,
			Instructions: "Rate the operational impact and severity of the log template.",
			Rubric:       []int{1, 2, 3, 4, 5},
		},
		"category": {
			Type:         QuestionTypeChoice,
			Instructions: "Determine the infrastructure or application subsystem responsible for this log event.",
			Options: []string{
				"database",
				"network",
				"auth",
				"disk_io",
				"application",
				"third_party",
			},
		},
		"is_outage": {
			Type:         QuestionTypeNoul,
			Instructions: "Does this log message indicate an active customer-facing service outage?",
		},
		"goal_completed": {
			Type:         QuestionTypeChoice,
			Instructions: "Evaluate whether the assistant answered the query and satisfied the user's objective, or if it gave up early or requires additional log data.",
			Options: []string{
				"completed",
				"needs_more_data",
				"clarification_needed",
			},
		},
	}
}

// NewRuleManager loads rule configurations from the specified path.
// If the file does not exist, it initializes with seed baseline rules and saves atomically to disk.
func NewRuleManager(configPath string) (*RuleManager, error) {
	if configPath == "" {
		return nil, fmt.Errorf("configPath cannot be empty")
	}

	cleanPath := filepath.Clean(configPath)
	data, err := os.ReadFile(cleanPath)
	if err != nil {
		if os.IsNotExist(err) {
			// Initialize with default seed rules
			initCheckpoint := Checkpoint{
				ID:          "chk_init",
				Timestamp:   time.Now().UTC().Format(time.RFC3339),
				Author:      "System Defaults",
				Description: "Default baseline rules for log triage and tool routing",
				Questions:   DefaultBaselineQuestions(),
			}

			cfg := RuleConfig{
				Enabled:          false,
				Device:           "cpu",
				ActiveCheckpoint: "chk_init",
				Checkpoints:      []Checkpoint{initCheckpoint},
			}

			rm := &RuleManager{
				configPath: cleanPath,
				config:     cfg,
			}

			if err := rm.saveLocked(); err != nil {
				return nil, fmt.Errorf("failed to initialize seed rules at %s: %w", cleanPath, err)
			}
			return rm, nil
		}
		return nil, fmt.Errorf("failed to read rule config from %s: %w", cleanPath, err)
	}

	var cfg RuleConfig
	if err := json.Unmarshal(data, &cfg); err != nil {
		return nil, fmt.Errorf("failed to parse rule config from %s: %w", cleanPath, err)
	}

	if cfg.Device == "" {
		cfg.Device = "cpu"
	}

	if len(cfg.Checkpoints) == 0 {
		initCheckpoint := Checkpoint{
			ID:          "chk_init",
			Timestamp:   time.Now().UTC().Format(time.RFC3339),
			Author:      "System Defaults",
			Description: "Default baseline rules for log triage and tool routing",
			Questions:   DefaultBaselineQuestions(),
		}
		cfg.Checkpoints = []Checkpoint{initCheckpoint}
		cfg.ActiveCheckpoint = "chk_init"
	} else if cfg.ActiveCheckpoint == "" {
		cfg.ActiveCheckpoint = cfg.Checkpoints[0].ID
	}

	return &RuleManager{
		configPath: cleanPath,
		config:     cfg,
	}, nil
}

// GetSettings returns current Laya engine settings along with the active questions map.
func (rm *RuleManager) GetSettings() LayaSettings {
	rm.mu.RLock()
	defer rm.mu.RUnlock()

	return LayaSettings{
		Enabled:          rm.config.Enabled,
		Device:           rm.config.Device,
		ActiveCheckpoint: rm.config.ActiveCheckpoint,
		Questions:        rm.getActiveQuestionsLocked(),
	}
}

// UpdateSettings updates the enabled status and hardware device ("cpu" or "gpu"), saving to disk.
func (rm *RuleManager) UpdateSettings(enabled bool, device string) error {
	if device == "" {
		device = "cpu"
	}
	if device != "cpu" && device != "gpu" {
		return fmt.Errorf("invalid device %q: must be 'cpu' or 'gpu'", device)
	}

	rm.mu.Lock()
	defer rm.mu.Unlock()

	prevEnabled := rm.config.Enabled
	prevDevice := rm.config.Device

	rm.config.Enabled = enabled
	rm.config.Device = device

	if err := rm.saveLocked(); err != nil {
		rm.config.Enabled = prevEnabled
		rm.config.Device = prevDevice
		return fmt.Errorf("failed to save updated settings: %w", err)
	}

	return nil
}

// GetActiveQuestions returns a cloned copy of the active question set.
func (rm *RuleManager) GetActiveQuestions() map[string]Question {
	rm.mu.RLock()
	defer rm.mu.RUnlock()

	return rm.getActiveQuestionsLocked()
}

// GetCheckpoints returns a copy of all versioned checkpoints.
func (rm *RuleManager) GetCheckpoints() []Checkpoint {
	rm.mu.RLock()
	defer rm.mu.RUnlock()

	cps := make([]Checkpoint, len(rm.config.Checkpoints))
	for i, cp := range rm.config.Checkpoints {
		cps[i] = Checkpoint{
			ID:          cp.ID,
			Timestamp:   cp.Timestamp,
			Author:      cp.Author,
			Description: cp.Description,
			Questions:   cloneQuestionsMap(cp.Questions),
		}
	}
	return cps
}

// RollbackToCheckpoint reverts the active rules to a previously saved checkpoint ID.
func (rm *RuleManager) RollbackToCheckpoint(checkpointID string) error {
	if checkpointID == "" {
		return fmt.Errorf("checkpointID cannot be empty")
	}

	rm.mu.Lock()
	defer rm.mu.Unlock()

	found := false
	for _, cp := range rm.config.Checkpoints {
		if cp.ID == checkpointID {
			found = true
			break
		}
	}
	if !found {
		return fmt.Errorf("checkpoint %q not found", checkpointID)
	}

	prevActive := rm.config.ActiveCheckpoint
	rm.config.ActiveCheckpoint = checkpointID

	if err := rm.saveLocked(); err != nil {
		rm.config.ActiveCheckpoint = prevActive
		return fmt.Errorf("failed to save rollback: %w", err)
	}

	return nil
}

// SaveCheckpoint validates and records a new versioned rule checkpoint, making it active.
func (rm *RuleManager) SaveCheckpoint(author string, description string, questions map[string]Question) (*Checkpoint, error) {
	if len(questions) == 0 {
		return nil, fmt.Errorf("questions map cannot be empty")
	}

	for name, q := range questions {
		if name == "" {
			return nil, fmt.Errorf("question name cannot be empty")
		}
		switch q.Type {
		case QuestionTypeChoice:
			if len(q.Options) == 0 {
				return nil, fmt.Errorf("question %q of type 'choice' must have options", name)
			}
		case QuestionTypeScore:
			if len(q.Rubric) == 0 {
				return nil, fmt.Errorf("question %q of type 'score' must have rubric", name)
			}
		case QuestionTypeNoul:
			// No options or rubric required
		default:
			return nil, fmt.Errorf("question %q has invalid question type %q", name, q.Type)
		}
	}

	if author == "" {
		author = "User"
	}

	rm.mu.Lock()
	defer rm.mu.Unlock()

	newID := fmt.Sprintf("chk_%s", uuid.New().String()[:8])
	newCP := Checkpoint{
		ID:          newID,
		Timestamp:   time.Now().UTC().Format(time.RFC3339),
		Author:      author,
		Description: description,
		Questions:   cloneQuestionsMap(questions),
	}

	prevCheckpoints := rm.config.Checkpoints
	prevActive := rm.config.ActiveCheckpoint

	rm.config.Checkpoints = append(rm.config.Checkpoints, newCP)
	rm.config.ActiveCheckpoint = newID

	if err := rm.saveLocked(); err != nil {
		rm.config.Checkpoints = prevCheckpoints
		rm.config.ActiveCheckpoint = prevActive
		return nil, fmt.Errorf("failed to save checkpoint: %w", err)
	}

	ret := Checkpoint{
		ID:          newCP.ID,
		Timestamp:   newCP.Timestamp,
		Author:      newCP.Author,
		Description: newCP.Description,
		Questions:   cloneQuestionsMap(newCP.Questions),
	}
	return &ret, nil
}

// getActiveQuestionsLocked finds and clones the active questions without locking.
func (rm *RuleManager) getActiveQuestionsLocked() map[string]Question {
	for _, cp := range rm.config.Checkpoints {
		if cp.ID == rm.config.ActiveCheckpoint {
			return cloneQuestionsMap(cp.Questions)
		}
	}
	if len(rm.config.Checkpoints) > 0 {
		return cloneQuestionsMap(rm.config.Checkpoints[len(rm.config.Checkpoints)-1].Questions)
	}
	return make(map[string]Question)
}

// saveLocked encodes config as indented JSON and writes atomically to disk.
func (rm *RuleManager) saveLocked() error {
	data, err := json.MarshalIndent(rm.config, "", "  ")
	if err != nil {
		return fmt.Errorf("failed to marshal rule config: %w", err)
	}
	data = append(data, '\n')
	return atomicWriteFile(rm.configPath, data, 0644)
}

// atomicWriteFile safely writes data to a temporary file in the same directory,
// flushes and closes it, and renames it over the target path to prevent corruption.
func atomicWriteFile(filename string, data []byte, perm os.FileMode) error {
	dir := filepath.Dir(filename)
	if err := os.MkdirAll(dir, 0755); err != nil {
		return fmt.Errorf("failed to create directory %s: %w", dir, err)
	}

	tmpFile, err := os.CreateTemp(dir, filepath.Base(filename)+".*.tmp")
	if err != nil {
		return fmt.Errorf("failed to create temp file: %w", err)
	}
	tmpName := tmpFile.Name()

	cleanup := true
	defer func() {
		if cleanup {
			_ = os.Remove(tmpName)
		}
	}()

	if _, err := tmpFile.Write(data); err != nil {
		_ = tmpFile.Close()
		return fmt.Errorf("failed to write temp file: %w", err)
	}
	if err := tmpFile.Sync(); err != nil {
		_ = tmpFile.Close()
		return fmt.Errorf("failed to sync temp file: %w", err)
	}
	if err := tmpFile.Close(); err != nil {
		return fmt.Errorf("failed to close temp file: %w", err)
	}

	if err := os.Chmod(tmpName, perm); err != nil {
		// Non-fatal on some OS environments
	}

	if err := os.Rename(tmpName, filename); err != nil {
		// Retry once in case of transient Windows file locks
		time.Sleep(10 * time.Millisecond)
		if err2 := os.Rename(tmpName, filename); err2 != nil {
			return fmt.Errorf("failed to rename %s to %s: %w", tmpName, filename, err)
		}
	}

	cleanup = false
	return nil
}

// cloneQuestionsMap creates a deep copy of a questions map.
func cloneQuestionsMap(in map[string]Question) map[string]Question {
	if in == nil {
		return make(map[string]Question)
	}
	out := make(map[string]Question, len(in))
	for k, v := range in {
		var opts []string
		if v.Options != nil {
			opts = make([]string, len(v.Options))
			copy(opts, v.Options)
		}
		var rubric []int
		if v.Rubric != nil {
			rubric = make([]int, len(v.Rubric))
			copy(rubric, v.Rubric)
		}
		out[k] = Question{
			Type:         v.Type,
			Instructions: v.Instructions,
			Options:      opts,
			Rubric:       rubric,
		}
	}
	return out
}
