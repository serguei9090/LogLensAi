// Assume Role: The Backend Engineer (@backend)

package app

import (
	"context"
	"log"
	"sync"
	"time"

	"loglensai/backend-go/internal/ai/laya"
	"loglensai/backend-go/internal/db"
)

// LayaClusterTriager implements clustering.ClusterTriageHandler using the Laya System 1 engine.
type LayaClusterTriager struct {
	app        *App
	seenMu     sync.RWMutex
	seenTmpls  map[string]string // key: workspaceID + ":" + clusterID -> template text
	sem        chan struct{}     // bounded concurrency limiter (max 4 parallel Laya inferences)
}

// NewLayaClusterTriager creates a triager bound to the application instance.
func NewLayaClusterTriager(app *App) *LayaClusterTriager {
	return &LayaClusterTriager{
		app:       app,
		seenTmpls: make(map[string]string),
		sem:       make(chan struct{}, 4),
	}
}

// TriageClustersAsync implements clustering.ClusterTriageHandler.
// Spawns a background worker to evaluate new cluster templates using active Laya rules.
func (t *LayaClusterTriager) TriageClustersAsync(workspaceID string, templates map[string]string) {
	if t.app == nil || t.app.LayaManager == nil || t.app.LayaEngine == nil {
		return
	}

	settings := t.app.LayaManager.GetSettings()
	if !settings.Enabled {
		return
	}

	// Filter down to templates that are new or whose text changed
	toProcess := make(map[string]string)
	t.seenMu.Lock()
	for clusterID, tmpl := range templates {
		k := workspaceID + ":" + clusterID
		if prev, ok := t.seenTmpls[k]; !ok || prev != tmpl {
			t.seenTmpls[k] = tmpl
			toProcess[clusterID] = tmpl
		}
	}
	t.seenMu.Unlock()

	if len(toProcess) == 0 {
		return
	}

	// Run triage in background
	go t.processTemplates(workspaceID, toProcess, settings.Questions)
}

func (t *LayaClusterTriager) processTemplates(workspaceID string, templates map[string]string, questions map[string]laya.Question) {
	ctx, cancel := context.WithTimeout(context.Background(), 2*time.Minute)
	defer cancel()

	for clusterID, templateText := range templates {
		select {
		case <-ctx.Done():
			return
		case t.sem <- struct{}{}:
		}

		go func(cID, tmpl string) {
			defer func() { <-t.sem }()

			triageRecord := t.evaluateSingleTemplate(ctx, workspaceID, cID, tmpl, questions)
			if triageRecord != nil && t.app.DB != nil {
				if err := t.app.DB.UpsertClusterTriage(*triageRecord); err != nil {
					log.Printf("[LayaTriager] failed to upsert triage for cluster %s/%s: %v", workspaceID, cID, err)
				}
			}
		}(clusterID, templateText)
	}
}

func (t *LayaClusterTriager) evaluateSingleTemplate(ctx context.Context, workspaceID, clusterID, tmpl string, questions map[string]laya.Question) *db.ClusterTriage {
	// Filter questions down to triage-relevant questions (category, severity, is_outage)
	triageQuestions := make(map[string]laya.Question)
	for name, q := range questions {
		if name == "category" || name == "severity" || name == "is_outage" {
			triageQuestions[name] = q
		}
	}

	// If none found, fallback to baseline triage questions
	if len(triageQuestions) == 0 {
		triageQuestions = map[string]laya.Question{
			"category": {
				Type:         laya.QuestionTypeChoice,
				Instructions: "Determine the infrastructure or application subsystem responsible for this log event.",
				Options:      []string{"database", "network", "auth", "disk_io", "application", "third_party"},
			},
			"severity": {
				Type:         laya.QuestionTypeScore,
				Instructions: "Rate the operational impact and severity of the log template.",
				Rubric:       []int{1, 2, 3, 4, 5},
			},
			"is_outage": {
				Type:         laya.QuestionTypeNoul,
				Instructions: "Does this log message indicate an active customer-facing service outage?",
			},
		}
	}

	results, err := t.app.LayaEngine.PredictBatch(ctx, triageQuestions, tmpl)
	if err != nil {
		log.Printf("[LayaTriager] predict error for cluster %s: %v", clusterID, err)
		return nil
	}

	rec := &db.ClusterTriage{
		WorkspaceID: workspaceID,
		ClusterID:   clusterID,
		Template:    tmpl,
		Category:    "application",
		Severity:    2.0,
		IsOutage:    false,
		Confidence:  0.8,
	}

	var confSum float32
	var confCount int

	if catRes, ok := results["category"]; ok && catRes != nil {
		if catRes.SelectedLabel != "" {
			rec.Category = catRes.SelectedLabel
		}
		confSum += catRes.Confidence
		confCount++
	}

	if sevRes, ok := results["severity"]; ok && sevRes != nil {
		rec.Severity = float64(sevRes.SelectedScore)
		confSum += sevRes.Confidence
		confCount++
	}

	if outRes, ok := results["is_outage"]; ok && outRes != nil {
		rec.IsOutage = outRes.SelectedLabel == "true"
		confSum += outRes.Confidence
		confCount++
	}

	if confCount > 0 {
		rec.Confidence = float64(confSum / float32(confCount))
	}

	return rec
}
