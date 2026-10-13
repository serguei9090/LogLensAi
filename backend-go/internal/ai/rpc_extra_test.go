package ai

import (
	"context"
	"errors"
	"regexp"
	"strings"
	"testing"

	"loglensai/backend-go/internal/ai/providers"
	"loglensai/backend-go/internal/ai/rag"
	"loglensai/backend-go/internal/app"
	"loglensai/backend-go/internal/models"
)

// newTestApp is already defined in wiring_test.go -- reused here as-is.

// fakeProvider is a minimal scriptable providers.Provider double, used to
// exercise Extra's six handlers without a real Ollama/OpenAI/Gemini client.
type fakeProvider struct {
	listModels []string
	listErr    error

	chatResp         providers.ChatMessage
	chatErr          error
	lastChatMessages []providers.ChatMessage

	analyzeResult       providers.AnalysisResult
	analyzeErr          error
	lastAnalyzeTemplate string
	lastAnalyzeSamples  []string

	testConnErr error
}

func (f *fakeProvider) ListModels(context.Context) ([]string, error) { return f.listModels, f.listErr }

func (f *fakeProvider) Chat(_ context.Context, messages []providers.ChatMessage, _, _ string, _ bool, _ []providers.ToolSchema) (providers.ChatMessage, error) {
	f.lastChatMessages = messages
	return f.chatResp, f.chatErr
}

func (f *fakeProvider) ChatStream(context.Context, []providers.ChatMessage, string, string, bool, []providers.ToolSchema) (<-chan providers.StreamChunk, error) {
	return nil, nil
}

func (f *fakeProvider) AnalyzeLogs(_ context.Context, template string, samples []string) (providers.AnalysisResult, error) {
	f.lastAnalyzeTemplate = template
	f.lastAnalyzeSamples = samples
	return f.analyzeResult, f.analyzeErr
}

func (f *fakeProvider) TestConnection(context.Context) error { return f.testConnErr }

func newTestExtra(a *app.App, fake providers.Provider) *Extra {
	return &Extra{app: a, provider: fake, isExplicitProvider: true, memory: newLazyMemoryService(a.DataDir(), a.DB.Conn)}
}

// --- analyze_cluster --------------------------------------------------------

func TestExtra_AnalyzeCluster_HydratesSamplesAndCallsProvider(t *testing.T) {
	a := newTestApp(t)

	lines := []string{"user 1 logged in", "user 2 logged in", "user 3 logged in"}
	if _, err := a.LogStore.AppendBatch("src1", lines); err != nil {
		t.Fatalf("AppendBatch: %v", err)
	}
	for i, l := range lines {
		_ = l
		if _, err := a.DB.Conn.Exec(
			`INSERT INTO logs (workspace_id, source_id, line_id, cluster_id, timestamp, level, processed) VALUES (?, ?, ?, ?, ?, ?, TRUE)`,
			"ws1", "src1", i, "5", "2024-01-01 00:00:00", "INFO",
		); err != nil {
			t.Fatalf("insert log %d: %v", i, err)
		}
	}

	fake := &fakeProvider{analyzeResult: providers.AnalysisResult{
		Summary: "Repeated logins", RootCause: "normal traffic", RecommendedActions: []string{"none"},
	}}
	extra := newTestExtra(a, fake)

	result, rpcErr := extra.AnalyzeCluster(context.Background(), models.AnalyzeClusterRequest{
		WorkspaceID: "ws1", ClusterID: "5", SampleSize: 10,
	})
	if rpcErr != nil {
		t.Fatalf("AnalyzeCluster: %+v", rpcErr)
	}
	resp, ok := result.(models.AnalyzeClusterResponse)
	if !ok {
		t.Fatalf("unexpected result type %T: %+v", result, result)
	}
	if resp.Summary != "Repeated logins" || resp.RootCause != "normal traffic" {
		t.Errorf("unexpected result: %+v", resp)
	}

	if len(fake.lastAnalyzeSamples) != 3 {
		t.Fatalf("expected 3 hydrated samples, got %d: %v", len(fake.lastAnalyzeSamples), fake.lastAnalyzeSamples)
	}
	for i, want := range lines {
		if fake.lastAnalyzeSamples[i] != want {
			t.Errorf("sample[%d] = %q, want %q", i, fake.lastAnalyzeSamples[i], want)
		}
	}
}

func TestExtra_AnalyzeCluster_DefaultsSampleSize(t *testing.T) {
	a := newTestApp(t)
	fake := &fakeProvider{}
	extra := newTestExtra(a, fake)

	// No matching logs rows at all -- should still succeed with 0 samples
	// and an empty template (no matching cluster in a fresh miner), not
	// error out.
	_, rpcErr := extra.AnalyzeCluster(context.Background(), models.AnalyzeClusterRequest{
		WorkspaceID: "ws1", ClusterID: "999", SampleSize: 0,
	})
	if rpcErr != nil {
		t.Fatalf("AnalyzeCluster: %+v", rpcErr)
	}
	if len(fake.lastAnalyzeSamples) != 0 {
		t.Errorf("expected 0 samples, got %v", fake.lastAnalyzeSamples)
	}
}

type fakeMemorySearcher struct {
	results   []rag.MemoryResult
	err       error
	lastQuery string
}

func (f *fakeMemorySearcher) SearchMemory(_ context.Context, _, query string, _ int) ([]rag.MemoryResult, error) {
	f.lastQuery = query
	return f.results, f.err
}

func TestExtra_AnalyzeCluster_KnownIssue_WithMemoryMatch(t *testing.T) {
	a := newTestApp(t)

	lines := []string{"connection failed to auth-service: timeout"}
	if _, err := a.LogStore.AppendBatch("src1", lines); err != nil {
		t.Fatalf("AppendBatch: %v", err)
	}
	if _, err := a.DB.Conn.Exec(
		`INSERT INTO logs (workspace_id, source_id, line_id, cluster_id, timestamp, level, processed) VALUES (?, ?, ?, ?, ?, ?, TRUE)`,
		"ws1", "src1", 0, "42", "2024-01-01 00:00:00", "ERROR",
	); err != nil {
		t.Fatalf("insert log: %v", err)
	}

	fake := &fakeProvider{analyzeResult: providers.AnalysisResult{
		Summary:            "Auth timeout issue",
		RootCause:          "auth-service unreachable",
		RecommendedActions: []string{"check service health"},
	}}
	extra := newTestExtra(a, fake)

	// Injected memory match with high similarity (distance = 0.15 -> similarity = 0.85 >= 0.70 threshold)
	memSearcher := &fakeMemorySearcher{
		results: []rag.MemoryResult{
			{
				IssueSignature: "connection failed to auth-service",
				Resolution:     "Restart auth-service pod and renew mTLS cert",
				Distance:       0.15,
			},
		},
	}
	extra.SetMemorySearcher(memSearcher)

	result, rpcErr := extra.AnalyzeCluster(context.Background(), models.AnalyzeClusterRequest{
		WorkspaceID: "ws1",
		ClusterID:   "42",
		SampleSize:  10,
	})
	if rpcErr != nil {
		t.Fatalf("AnalyzeCluster: %+v", rpcErr)
	}
	resp, ok := result.(models.AnalyzeClusterResponse)
	if !ok {
		t.Fatalf("unexpected result type %T: %+v", result, result)
	}

	// 1. Verify KNOWN ISSUE identification and tags
	if resp.IsKnownIssue != true {
		t.Errorf("expected is_known_issue true, got %v", resp.IsKnownIssue)
	}
	if resp.Classification != "KNOWN ISSUE" {
		t.Errorf("expected classification 'KNOWN ISSUE', got %v", resp.Classification)
	}
	if resp.Tag != TagKnownIssue {
		t.Errorf("expected tag %q, got %q", TagKnownIssue, resp.Tag)
	}
	if resp.MatchedSignature != "connection failed to auth-service" {
		t.Errorf("expected matched signature, got %v", resp.MatchedSignature)
	}
	if resp.KnownResolution != "Restart auth-service pod and renew mTLS cert" {
		t.Errorf("expected known resolution, got %v", resp.KnownResolution)
	}
	if resp.MatchScore < 0.84 || resp.MatchScore > 0.86 {
		t.Errorf("expected match_score approx 0.85, got %v", resp.MatchScore)
	}

	// 2. Verify prior resolution was injected into AI prompt
	if !strings.Contains(fake.lastAnalyzeTemplate, "[PRIOR KNOWN INCIDENT IN MEMORY]") {
		t.Errorf("expected prompt template to contain prior incident memory, got: %q", fake.lastAnalyzeTemplate)
	}
	if !strings.Contains(fake.lastAnalyzeTemplate, "Restart auth-service pod and renew mTLS cert") {
		t.Errorf("expected prompt template to contain prior resolution, got: %q", fake.lastAnalyzeTemplate)
	}

	// 3. Verify recommended actions includes proven resolution
	hasProven := false
	for _, act := range resp.RecommendedActions {
		if strings.Contains(act, "Proven Resolution from Memory") && strings.Contains(act, "Restart auth-service pod") {
			hasProven = true
			break
		}
	}
	if !hasProven {
		t.Errorf("expected recommended_actions to contain proven resolution, got: %v", resp.RecommendedActions)
	}

	// 4. Verify DB persistence in cluster_triage
	triage, tErr := a.DB.GetClusterTriage("ws1", "42")
	if tErr != nil || triage == nil {
		t.Fatalf("GetClusterTriage failed: %v", tErr)
	}
	if !triage.IsKnownIssue {
		t.Errorf("expected triage.IsKnownIssue true in DB, got false")
	}
	if triage.RAGTag != TagKnownIssue {
		t.Errorf("expected triage.RAGTag %q in DB, got %q", TagKnownIssue, triage.RAGTag)
	}
	if triage.KnownResolution != "Restart auth-service pod and renew mTLS cert" {
		t.Errorf("expected triage.KnownResolution in DB, got %q", triage.KnownResolution)
	}

	// 5. Verify App.GetClusters includes RAG triage attributes
	clustersResult, cErr := a.GetClusters("ws1")
	if cErr != nil {
		t.Fatalf("GetClusters failed: %+v", cErr)
	}
	clustersSlice, ok := clustersResult.([]map[string]any)
	if !ok {
		t.Fatalf("unexpected GetClusters type: %T", clustersResult)
	}
	found := false
	for _, c := range clustersSlice {
		if c["rag_tag"] == TagKnownIssue && c["is_known_issue"] == true {
			found = true
			if c["known_resolution"] != "Restart auth-service pod and renew mTLS cert" {
				t.Errorf("expected cluster known_resolution, got %v", c["known_resolution"])
			}
			break
		}
	}
	if !found {
		// Clusters slice might be empty if miner had no clusters, but DB triage map exists
		triageMap, _ := a.DB.GetClusterTriageMap("ws1")
		if rec, exists := triageMap["42"]; !exists || !rec.IsKnownIssue {
			t.Errorf("expected cluster 42 to be marked as known issue in triageMap: %+v", triageMap)
		}
	}
}

func TestExtra_AnalyzeCluster_NewAnomaly_WhenBelowThreshold(t *testing.T) {
	a := newTestApp(t)

	lines := []string{"disk quota exceeded for user 100"}
	if _, err := a.LogStore.AppendBatch("src1", lines); err != nil {
		t.Fatalf("AppendBatch: %v", err)
	}
	if _, err := a.DB.Conn.Exec(
		`INSERT INTO logs (workspace_id, source_id, line_id, cluster_id, timestamp, level, processed) VALUES (?, ?, ?, ?, ?, ?, TRUE)`,
		"ws1", "src1", 0, "99", "2024-01-01 00:00:00", "WARN",
	); err != nil {
		t.Fatalf("insert log: %v", err)
	}

	fake := &fakeProvider{analyzeResult: providers.AnalysisResult{
		Summary:   "Disk quota warning",
		RootCause: "User disk quota exceeded",
	}}
	extra := newTestExtra(a, fake)

	// Distance 0.60 -> similarity = 0.40 < 0.70 threshold
	memSearcher := &fakeMemorySearcher{
		results: []rag.MemoryResult{
			{
				IssueSignature: "database connection timeout",
				Resolution:     "reboot db",
				Distance:       0.60,
			},
		},
	}
	extra.SetMemorySearcher(memSearcher)

	result, rpcErr := extra.AnalyzeCluster(context.Background(), models.AnalyzeClusterRequest{
		WorkspaceID: "ws1",
		ClusterID:   "99",
		SampleSize:  10,
	})
	if rpcErr != nil {
		t.Fatalf("AnalyzeCluster: %+v", rpcErr)
	}
	resp, ok := result.(models.AnalyzeClusterResponse)
	if !ok {
		t.Fatalf("unexpected result type %T", result)
	}

	if resp.IsKnownIssue != false {
		t.Errorf("expected is_known_issue false, got %v", resp.IsKnownIssue)
	}
	if resp.Classification != "NEW ANOMALY" {
		t.Errorf("expected classification 'NEW ANOMALY', got %v", resp.Classification)
	}
	if resp.Tag != TagNewAnomaly {
		t.Errorf("expected tag %q, got %q", TagNewAnomaly, resp.Tag)
	}
	if resp.MatchedSignature != "" {
		t.Errorf("expected empty matched_signature, got %v", resp.MatchedSignature)
	}

	triage, tErr := a.DB.GetClusterTriage("ws1", "99")
	if tErr != nil || triage == nil {
		t.Fatalf("GetClusterTriage failed: %v", tErr)
	}
	if triage.IsKnownIssue != false {
		t.Errorf("expected triage.IsKnownIssue false in DB, got true")
	}
	if triage.RAGTag != TagNewAnomaly {
		t.Errorf("expected triage.RAGTag %q in DB, got %q", TagNewAnomaly, triage.RAGTag)
	}
}

func TestExtra_AnalyzeCluster_CustomThreshold(t *testing.T) {
	a := newTestApp(t)

	lines := []string{"partial signature match in logs"}
	if _, err := a.LogStore.AppendBatch("src1", lines); err != nil {
		t.Fatalf("AppendBatch: %v", err)
	}
	if _, err := a.DB.Conn.Exec(
		`INSERT INTO logs (workspace_id, source_id, line_id, cluster_id, timestamp, level, processed) VALUES (?, ?, ?, ?, ?, ?, TRUE)`,
		"ws1", "src1", 0, "77", "2024-01-01 00:00:00", "INFO",
	); err != nil {
		t.Fatalf("insert log: %v", err)
	}

	fake := &fakeProvider{analyzeResult: providers.AnalysisResult{
		Summary: "General log event",
	}}
	extra := newTestExtra(a, fake)

	// Distance 0.60 -> similarity = 0.40. With custom threshold 0.35, this is a KNOWN ISSUE
	memSearcher := &fakeMemorySearcher{
		results: []rag.MemoryResult{
			{
				IssueSignature: "partial signature match",
				Resolution:     "apply hotfix",
				Distance:       0.60,
			},
		},
	}
	extra.SetMemorySearcher(memSearcher)

	customThresh := 0.35
	result, rpcErr := extra.AnalyzeCluster(context.Background(), models.AnalyzeClusterRequest{
		WorkspaceID:         "ws1",
		ClusterID:           "77",
		SampleSize:          5,
		SimilarityThreshold: &customThresh,
	})
	if rpcErr != nil {
		t.Fatalf("AnalyzeCluster: %+v", rpcErr)
	}
	resp := result.(models.AnalyzeClusterResponse)
	if resp.IsKnownIssue != true {
		t.Errorf("expected custom threshold to classify as known issue, got %v", resp.IsKnownIssue)
	}
	if resp.Classification != "KNOWN ISSUE" {
		t.Errorf("expected KNOWN ISSUE, got %v", resp.Classification)
	}
}

func TestExtra_AnalyzeCluster_TemplateFromTriageFallback(t *testing.T) {
	a := newTestApp(t)

	// Seed cluster_triage with an existing template when miner has not yet processed
	if err := a.DB.UpsertClusterRAGTag("ws1", "101", "Database connection pool exhausted", false, "", "", "", 0.0); err != nil {
		t.Fatalf("UpsertClusterRAGTag: %v", err)
	}

	fake := &fakeProvider{analyzeResult: providers.AnalysisResult{
		Summary:   "DB pool issue",
		RootCause: "pool exhausted",
	}}
	extra := newTestExtra(a, fake)

	memSearcher := &fakeMemorySearcher{
		results: []rag.MemoryResult{
			{
				IssueSignature: "Database connection pool exhausted",
				Resolution:     "Increase max_connections parameter in db.conf",
				Distance:       0.05,
			},
		},
	}
	extra.SetMemorySearcher(memSearcher)

	result, rpcErr := extra.AnalyzeCluster(context.Background(), models.AnalyzeClusterRequest{
		WorkspaceID: "ws1",
		ClusterID:   "101",
		SampleSize:  5,
	})
	if rpcErr != nil {
		t.Fatalf("AnalyzeCluster: %+v", rpcErr)
	}
	resp := result.(models.AnalyzeClusterResponse)
	if !resp.IsKnownIssue {
		t.Errorf("expected is_known_issue true from fallback template, got false")
	}
	if resp.KnownResolution != "Increase max_connections parameter in db.conf" {
		t.Errorf("unexpected known resolution: %s", resp.KnownResolution)
	}
	if memSearcher.lastQuery != "Database connection pool exhausted" {
		t.Errorf("expected query %q, got %q", "Database connection pool exhausted", memSearcher.lastQuery)
	}
}

func TestExtra_AnalyzeCluster_MemoryErrorGracefulFallback(t *testing.T) {
	a := newTestApp(t)

	fake := &fakeProvider{analyzeResult: providers.AnalysisResult{
		Summary: "Normal flow",
	}}
	extra := newTestExtra(a, fake)

	// Memory searcher errors out
	memSearcher := &fakeMemorySearcher{
		err: errors.New("vss index locked"),
	}
	extra.SetMemorySearcher(memSearcher)

	result, rpcErr := extra.AnalyzeCluster(context.Background(), models.AnalyzeClusterRequest{
		WorkspaceID: "ws1",
		ClusterID:   "88",
		SampleSize:  5,
	})
	if rpcErr != nil {
		t.Fatalf("AnalyzeCluster should succeed even if memory lookup fails, got: %+v", rpcErr)
	}
	resp := result.(models.AnalyzeClusterResponse)
	if resp.IsKnownIssue != false {
		t.Errorf("expected is_known_issue false on memory error fallback, got %v", resp.IsKnownIssue)
	}
	if resp.Tag != TagNewAnomaly {
		t.Errorf("expected tag %q, got %q", TagNewAnomaly, resp.Tag)
	}
}

// --- list_ai_models / test_ai_connection ------------------------------------

func TestExtra_ListModels(t *testing.T) {
	a := newTestApp(t)
	fake := &fakeProvider{listModels: []string{"llama3", "mistral"}}
	extra := newTestExtra(a, fake)

	result, rpcErr := extra.ListModels(context.Background())
	if rpcErr != nil {
		t.Fatalf("ListModels: %+v", rpcErr)
	}
	got, ok := result.([]string)
	if !ok || len(got) != 2 || got[0] != "llama3" || got[1] != "mistral" {
		t.Errorf("ListModels result = %+v (%T)", result, result)
	}
}

func TestExtra_ListModels_PropagatesError(t *testing.T) {
	a := newTestApp(t)
	fake := &fakeProvider{listErr: errors.New("connection refused")}
	extra := newTestExtra(a, fake)

	_, rpcErr := extra.ListModels(context.Background())
	if rpcErr == nil {
		t.Fatal("expected an RPCError")
	}
}

func TestExtra_TestConnection_Success(t *testing.T) {
	a := newTestApp(t)
	extra := newTestExtra(a, &fakeProvider{})

	result, rpcErr := extra.TestConnection(context.Background())
	if rpcErr != nil {
		t.Fatalf("TestConnection: %+v", rpcErr)
	}
	m := result.(map[string]any)
	if m["status"] != "success" {
		t.Errorf("status = %v, want success", m["status"])
	}
}

func TestExtra_TestConnection_Failure(t *testing.T) {
	a := newTestApp(t)
	extra := newTestExtra(a, &fakeProvider{testConnErr: errors.New("bad api key")})

	result, rpcErr := extra.TestConnection(context.Background())
	if rpcErr != nil {
		t.Fatalf("TestConnection returned an RPCError instead of a status dict: %+v", rpcErr)
	}
	m := result.(map[string]any)
	if m["status"] != "error" || m["message"] != "bad api key" {
		t.Errorf("unexpected result: %+v", m)
	}
}

// --- generate_facet_regex ----------------------------------------------------

func TestExtra_GenerateFacetRegex_UsesModelRegexWhenValid(t *testing.T) {
	a := newTestApp(t)
	fake := &fakeProvider{chatResp: providers.ChatMessage{Content: "`(\\d+)`"}}
	extra := newTestExtra(a, fake)

	result, rpcErr := extra.GenerateFacetRegex(context.Background(), models.GenerateExtractionRegexRequest{
		LogLine: "user id 123 logged in", SelectedText: "123",
	})
	if rpcErr != nil {
		t.Fatalf("GenerateFacetRegex: %+v", rpcErr)
	}
	m := result.(map[string]any)
	if m["regex"] != `(\d+)` {
		t.Errorf("regex = %v, want (\\d+)", m["regex"])
	}
	if len(fake.lastChatMessages) != 1 || fake.lastChatMessages[0].Role != "user" {
		t.Errorf("expected exactly one user chat message, got %+v", fake.lastChatMessages)
	}
}

func TestExtra_GenerateFacetRegex_FallsBackOnInvalidRegex(t *testing.T) {
	a := newTestApp(t)
	fake := &fakeProvider{chatResp: providers.ChatMessage{Content: "not ( a valid regex["}}
	extra := newTestExtra(a, fake)

	result, rpcErr := extra.GenerateFacetRegex(context.Background(), models.GenerateExtractionRegexRequest{
		LogLine: "x", SelectedText: "123",
	})
	if rpcErr != nil {
		t.Fatalf("GenerateFacetRegex: %+v", rpcErr)
	}
	want := "(" + regexp.QuoteMeta("123") + ")"
	if result.(map[string]any)["regex"] != want {
		t.Errorf("regex = %v, want fallback %v", result.(map[string]any)["regex"], want)
	}
}

func TestExtra_GenerateFacetRegex_FallsBackWhenNoCapturingGroup(t *testing.T) {
	a := newTestApp(t)
	fake := &fakeProvider{chatResp: providers.ChatMessage{Content: `\d+`}}
	extra := newTestExtra(a, fake)

	result, rpcErr := extra.GenerateFacetRegex(context.Background(), models.GenerateExtractionRegexRequest{
		LogLine: "x", SelectedText: "123",
	})
	if rpcErr != nil {
		t.Fatalf("GenerateFacetRegex: %+v", rpcErr)
	}
	want := "(" + regexp.QuoteMeta("123") + ")"
	if result.(map[string]any)["regex"] != want {
		t.Errorf("regex = %v, want fallback %v (no capturing group in model output)", result.(map[string]any)["regex"], want)
	}
}

func TestExtra_GenerateFacetRegex_FallsBackOnProviderError(t *testing.T) {
	a := newTestApp(t)
	fake := &fakeProvider{chatErr: errors.New("model unreachable")}
	extra := newTestExtra(a, fake)

	result, rpcErr := extra.GenerateFacetRegex(context.Background(), models.GenerateExtractionRegexRequest{
		LogLine: "x", SelectedText: "abc",
	})
	if rpcErr != nil {
		t.Fatalf("GenerateFacetRegex: %+v", rpcErr)
	}
	want := "(" + regexp.QuoteMeta("abc") + ")"
	if result.(map[string]any)["regex"] != want {
		t.Errorf("regex = %v, want fallback %v", result.(map[string]any)["regex"], want)
	}
}

// --- save_memory / search_memory --------------------------------------------

// TestExtra_SaveAndSearchMemory exercises the real rag.Service through
// Extra's lazy accessor, skipping (matching internal/ai/rag's own test
// convention -- see rag/testhelpers_test.go) if the ONNX embedding backend
// isn't available in this environment.
func TestExtra_SaveAndSearchMemory(t *testing.T) {
	a := newTestApp(t)
	extra := newTestExtra(a, &fakeProvider{})

	saveResult, rpcErr := extra.SaveMemory(context.Background(), models.SaveMemoryRequest{
		WorkspaceID:    "ws1",
		IssueSignature: "Disk usage at 95% on /var partition",
		Resolution:     "Rotate and compress old log files under /var/log",
	})
	if rpcErr != nil {
		t.Skipf("rag memory backend not available in this environment (%s) -- skipping", rpcErr.Message)
	}
	if m, ok := saveResult.(map[string]any); !ok || m["status"] != "ok" {
		t.Fatalf("SaveMemory result = %+v", saveResult)
	}

	searchResult, rpcErr := extra.SearchMemory(context.Background(), models.SearchMemoryRequest{
		WorkspaceID: "ws1",
		Query:       "disk space running low",
		Limit:       5,
	})
	if rpcErr != nil {
		t.Fatalf("SearchMemory: %+v", rpcErr)
	}
	rows, ok := searchResult.([]map[string]any)
	if !ok {
		t.Fatalf("unexpected SearchMemory result type %T", searchResult)
	}
	if len(rows) == 0 {
		t.Fatal("expected at least one search result")
	}
	if rows[0]["issue_signature"] != "Disk usage at 95% on /var partition" {
		t.Errorf("unexpected top result: %+v", rows[0])
	}
	if _, ok := rows[0]["distance"].(float64); !ok {
		t.Errorf("expected distance to be a float64, got %T", rows[0]["distance"])
	}
}

func TestExtra_SearchMemory_DefaultsLimit(t *testing.T) {
	a := newTestApp(t)
	extra := newTestExtra(a, &fakeProvider{})

	_, rpcErr := extra.SearchMemory(context.Background(), models.SearchMemoryRequest{
		WorkspaceID: "ws1", Query: "anything", Limit: 0,
	})
	if rpcErr != nil {
		t.Skipf("rag memory backend not available in this environment (%s) -- skipping", rpcErr.Message)
	}
}
