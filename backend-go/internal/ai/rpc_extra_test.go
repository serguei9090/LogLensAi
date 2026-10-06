package ai

import (
	"context"
	"errors"
	"regexp"
	"testing"

	"loglensai/backend-go/internal/ai/providers"
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
	m, ok := result.(map[string]any)
	if !ok {
		t.Fatalf("unexpected result type %T: %+v", result, result)
	}
	if m["summary"] != "Repeated logins" || m["root_cause"] != "normal traffic" {
		t.Errorf("unexpected result: %+v", m)
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
