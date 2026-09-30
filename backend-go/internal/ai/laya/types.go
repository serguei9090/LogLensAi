// Assume Role: The Backend Engineer (@backend)

package laya

import (
	"encoding/json"
)

// QuestionType represents the evaluation format of a Laya decision task.
type QuestionType string

const (
	// QuestionTypeChoice indicates a single-choice categorical classification.
	QuestionTypeChoice QuestionType = "choice"
	// QuestionTypeScore indicates a numeric rating based on a rubric scale.
	QuestionTypeScore QuestionType = "score"
	// QuestionTypeNoul indicates a binary/probabilistic presence judgment (yes/no).
	QuestionTypeNoul QuestionType = "noul"
)

// Question defines a single prompt / decision rule for the Laya System 1 engine.
type Question struct {
	Type         QuestionType `json:"type"`
	Instructions string       `json:"instructions"`
	Options      []string     `json:"options,omitempty"`
	Rubric       []int        `json:"rubric,omitempty"`
}

// Checkpoint captures an immutable versioned snapshot of Laya rules.
type Checkpoint struct {
	ID          string              `json:"id"`
	Timestamp   string              `json:"timestamp"`
	Author      string              `json:"author"`
	Description string              `json:"description"`
	Questions   map[string]Question `json:"questions"`
}

// RuleConfig represents the persistent configuration schema stored on disk.
type RuleConfig struct {
	Enabled          bool         `json:"enabled"`
	Device           string       `json:"device"`
	ActiveCheckpoint string       `json:"active_checkpoint"`
	Checkpoints      []Checkpoint `json:"checkpoints"`
}

// UnmarshalJSON supports both snake_case (active_checkpoint) and camelCase (activeCheckpoint).
func (r *RuleConfig) UnmarshalJSON(data []byte) error {
	type Alias RuleConfig
	aux := struct {
		*Alias
		AltActiveCheckpoint string `json:"activeCheckpoint"`
	}{
		Alias: (*Alias)(r),
	}
	if err := json.Unmarshal(data, &aux); err != nil {
		return err
	}
	if r.ActiveCheckpoint == "" && aux.AltActiveCheckpoint != "" {
		r.ActiveCheckpoint = aux.AltActiveCheckpoint
	}
	return nil
}

// LayaSettings exposes runtime settings and active questions for the UI and RPC layer.
type LayaSettings struct {
	Enabled          bool                `json:"enabled"`
	Device           string              `json:"device"`
	ActiveCheckpoint string              `json:"active_checkpoint"`
	Questions        map[string]Question `json:"questions"`
}

// UnmarshalJSON supports both snake_case (active_checkpoint) and camelCase (activeCheckpoint).
func (s *LayaSettings) UnmarshalJSON(data []byte) error {
	type Alias LayaSettings
	aux := struct {
		*Alias
		AltActiveCheckpoint string `json:"activeCheckpoint"`
	}{
		Alias: (*Alias)(s),
	}
	if err := json.Unmarshal(data, &aux); err != nil {
		return err
	}
	if s.ActiveCheckpoint == "" && aux.AltActiveCheckpoint != "" {
		s.ActiveCheckpoint = aux.AltActiveCheckpoint
	}
	return nil
}
