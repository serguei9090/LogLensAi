package providers

import (
	"bufio"
	"bytes"
	"context"
	"encoding/json"
	"fmt"
	"io"
	"net/http"
	"strings"
	"time"
)

// GeminiProvider talks directly to Google's Generative Language REST API
// (https://generativelanguage.googleapis.com) using an AI Studio API key.
//
// Deviation from the Python source: sidecar/src/ai/ai_studio.py's
// AIStudioProvider does not call this REST API directly — it wraps
// google-adk's LlmAgent/Runner/InMemorySessionService, a Python-only agent
// framework with no Go equivalent (and no direct analogue worth
// hand-porting: it mostly re-implements session/history bookkeeping this
// Go codebase's own state-machine package already owns). This port instead
// talks to the underlying `:generateContent` / `:streamGenerateContent`
// REST endpoints ADK itself calls under the hood, which is the actual
// wire-format contract and is both simpler and framework-independent.
//
// sidecar/src/ai/gemini_cli.py (GeminiCLIProvider) was NOT ported at all:
// it is a local dev-tool wrapper around the `gemini` CLI binary (subprocess
// exec, or an A2A JSON-RPC server assumed running on localhost:22436) with
// no real API contract — a legacy/experimental path, not a deployable
// backend provider. AIStudioProvider is the actual API-based Gemini
// integration and is what this file ports.
//
// A second deviation: Python's AIStudioProvider.chat() does not accept a
// `tools` parameter at all (tool-calling was never wired up for Gemini in
// the Python source, only for Ollama/OpenAI-compatible). This port adds
// tool-calling support via Gemini's native `functionDeclarations` wire
// format so all three Go providers satisfy the same normalized Provider
// interface uniformly, per this phase's brief.
type GeminiProvider struct {
	apiKey       string
	activeModel  string
	systemPrompt string
	baseURL      string
	httpClient   *http.Client
}

// DefaultGeminiModel mirrors ai_studio.py's DEFAULT_MODEL.
const DefaultGeminiModel = "gemini-2.0-flash"

const geminiBaseURL = "https://generativelanguage.googleapis.com/v1beta"

// NewGeminiProvider constructs a GeminiProvider. model defaults to
// DefaultGeminiModel when empty, mirroring the Python constructor.
func NewGeminiProvider(apiKey, systemPrompt, model string) *GeminiProvider {
	if model == "" {
		model = DefaultGeminiModel
	}
	return &GeminiProvider{
		apiKey:       strings.TrimSpace(apiKey),
		activeModel:  model,
		systemPrompt: systemPrompt,
		baseURL:      geminiBaseURL,
		httpClient:   &http.Client{Timeout: 60 * time.Second},
	}
}

var _ Provider = (*GeminiProvider)(nil)

// --- wire types -------------------------------------------------------

type geminiPart struct {
	Text             string                  `json:"text,omitempty"`
	Thought          bool                    `json:"thought,omitempty"`
	FunctionCall     *geminiFunctionCall     `json:"functionCall,omitempty"`
	FunctionResponse *geminiFunctionResponse `json:"functionResponse,omitempty"`
}

type geminiFunctionCall struct {
	Name string          `json:"name"`
	Args json.RawMessage `json:"args,omitempty"`
}

type geminiFunctionResponse struct {
	Name     string          `json:"name"`
	Response json.RawMessage `json:"response,omitempty"`
}

type geminiContent struct {
	Role  string       `json:"role,omitempty"`
	Parts []geminiPart `json:"parts"`
}

type geminiFunctionDeclaration struct {
	Name        string          `json:"name"`
	Description string          `json:"description,omitempty"`
	Parameters  json.RawMessage `json:"parameters,omitempty"`
}

type geminiTool struct {
	FunctionDeclarations []geminiFunctionDeclaration `json:"functionDeclarations"`
}

type geminiGenerationConfig struct {
	ResponseMIMEType string `json:"responseMimeType,omitempty"`
}

type geminiGenerateRequest struct {
	Contents          []geminiContent         `json:"contents"`
	SystemInstruction *geminiContent          `json:"systemInstruction,omitempty"`
	Tools             []geminiTool            `json:"tools,omitempty"`
	GenerationConfig  *geminiGenerationConfig `json:"generationConfig,omitempty"`
}

type geminiCandidate struct {
	Content geminiContent `json:"content"`
}

type geminiGenerateResponse struct {
	Candidates []geminiCandidate `json:"candidates"`
}

type geminiModelsResponse struct {
	Models []struct {
		Name string `json:"name"`
	} `json:"models"`
}

// --- request building ---------------------------------------------------

// toGeminiTools converts normalized ToolSchema into Gemini's
// functionDeclarations wire format (a single Tool entry holding all
// declarations, which is how the Gemini API expects them).
func toGeminiTools(tools []ToolSchema) []geminiTool {
	if len(tools) == 0 {
		return nil
	}
	decls := make([]geminiFunctionDeclaration, 0, len(tools))
	for _, t := range tools {
		decls = append(decls, geminiFunctionDeclaration{
			Name:        t.Name,
			Description: t.Description,
			Parameters:  t.Parameters,
		})
	}
	return []geminiTool{{FunctionDeclarations: decls}}
}

// buildContents converts normalized ChatMessage history into Gemini's
// `contents` list plus an extracted system-instruction string. Any
// role=="system" message in the history is folded into the system
// instruction (Gemini has no "system" role in `contents`); role=="tool" is
// mapped to Gemini's "function" role with a functionResponse part.
func (p *GeminiProvider) buildContents(messages []ChatMessage) ([]geminiContent, string) {
	systemParts := []string{}
	if p.systemPrompt != "" {
		systemParts = append(systemParts, p.systemPrompt)
	}

	contents := make([]geminiContent, 0, len(messages))
	for _, m := range messages {
		switch m.Role {
		case "system":
			if m.Content != "" {
				systemParts = append(systemParts, m.Content)
			}
		case "user":
			contents = append(contents, geminiContent{Role: "user", Parts: []geminiPart{{Text: m.Content}}})
		case "assistant":
			parts := []geminiPart{}
			if cleaned := cleanThinkingMarkers(m.Content); cleaned != "" {
				parts = append(parts, geminiPart{Text: cleaned})
			}
			for _, tc := range m.ToolCalls {
				args := tc.Arguments
				if len(args) == 0 {
					args = json.RawMessage(`{}`)
				}
				parts = append(parts, geminiPart{FunctionCall: &geminiFunctionCall{Name: tc.Name, Args: args}})
			}
			if len(parts) == 0 {
				parts = append(parts, geminiPart{Text: ""})
			}
			contents = append(contents, geminiContent{Role: "model", Parts: parts})
		case "tool":
			response := json.RawMessage(m.Content)
			if !json.Valid(response) {
				wrapped, _ := json.Marshal(map[string]string{"result": m.Content})
				response = wrapped
			}
			contents = append(contents, geminiContent{
				Role: "function",
				Parts: []geminiPart{{
					FunctionResponse: &geminiFunctionResponse{Name: m.Name, Response: response},
				}},
			})
		}
	}

	return contents, strings.Join(systemParts, "\n\n")
}

func (p *GeminiProvider) newRequest(ctx context.Context, method, url string, body []byte) (*http.Request, error) {
	var reader io.Reader
	if body != nil {
		reader = bytes.NewReader(body)
	}
	req, err := http.NewRequestWithContext(ctx, method, url, reader)
	if err != nil {
		return nil, err
	}
	if body != nil {
		req.Header.Set("Content-Type", "application/json")
	}
	// Prefer the header form over Python/Google-SDK's `?key=` query param
	// so the key never lands in logs/proxies that record URLs.
	req.Header.Set("x-goog-api-key", p.apiKey)
	return req, nil
}

// normalizeGeminiToolCalls extracts functionCall parts from a candidate's
// content into normalized ToolCalls. Gemini never assigns call IDs, so one
// is synthesized (call_0, call_1, ...) for parity with the other
// providers' ToolCall.ID contract.
func normalizeGeminiToolCalls(parts []geminiPart) []ToolCall {
	var out []ToolCall
	for _, part := range parts {
		if part.FunctionCall == nil {
			continue
		}
		args := part.FunctionCall.Args
		if len(args) == 0 {
			args = json.RawMessage(`{}`)
		}
		out = append(out, ToolCall{
			ID:        fmt.Sprintf("call_%d", len(out)),
			Name:      part.FunctionCall.Name,
			Arguments: args,
		})
	}
	return out
}

func extractGeminiText(parts []geminiPart) string {
	var b strings.Builder
	for _, part := range parts {
		if part.FunctionCall == nil && part.FunctionResponse == nil {
			b.WriteString(part.Text)
		}
	}
	return b.String()
}

// --- Provider implementation ---------------------------------------------

func (p *GeminiProvider) ListModels(ctx context.Context) ([]string, error) {
	fallback := []string{DefaultGeminiModel}
	if p.apiKey == "" {
		return fallback, nil
	}

	req, err := p.newRequest(ctx, http.MethodGet, p.baseURL+"/models", nil)
	if err != nil {
		return fallback, nil
	}
	resp, err := p.httpClient.Do(req)
	if err != nil {
		return fallback, nil
	}
	defer resp.Body.Close()

	if resp.StatusCode != http.StatusOK {
		return fallback, nil
	}

	var data geminiModelsResponse
	if err := json.NewDecoder(resp.Body).Decode(&data); err != nil {
		return fallback, nil
	}

	models := make([]string, 0, len(data.Models))
	for _, m := range data.Models {
		lower := strings.ToLower(m.Name)
		if strings.Contains(lower, "gemini") || strings.Contains(lower, "gemma") {
			models = append(models, m.Name)
		}
	}
	if len(models) == 0 {
		return fallback, nil
	}
	return models, nil
}

func (p *GeminiProvider) targetModel(model string) string {
	if model != "" {
		return model
	}
	if p.activeModel != "" {
		return p.activeModel
	}
	return DefaultGeminiModel
}

func (p *GeminiProvider) Chat(ctx context.Context, messages []ChatMessage, sessionID, model string, reasoning bool, tools []ToolSchema) (ChatMessage, error) {
	if p.apiKey == "" {
		return ChatMessage{Role: "assistant", Content: "Error: No API Key configured."}, nil
	}

	targetModel := p.targetModel(model)
	contents, systemInstruction := p.buildContents(messages)

	payload := geminiGenerateRequest{
		Contents: contents,
		Tools:    toGeminiTools(tools),
	}
	if systemInstruction != "" {
		payload.SystemInstruction = &geminiContent{Parts: []geminiPart{{Text: systemInstruction}}}
	}

	body, err := json.Marshal(payload)
	if err != nil {
		return ChatMessage{}, fmt.Errorf("gemini: marshal request: %w", err)
	}

	url := fmt.Sprintf("%s/models/%s:generateContent", p.baseURL, targetModel)
	req, err := p.newRequest(ctx, http.MethodPost, url, body)
	if err != nil {
		return ChatMessage{}, fmt.Errorf("gemini: build request: %w", err)
	}

	resp, err := p.httpClient.Do(req)
	if err != nil {
		return ChatMessage{Role: "assistant", Content: "AI Studio Error: " + err.Error()}, nil
	}
	defer resp.Body.Close()

	if resp.StatusCode != http.StatusOK {
		errText, _ := io.ReadAll(resp.Body)
		return ChatMessage{Role: "assistant", Content: "AI Studio Error: " + string(errText)}, nil
	}

	var data geminiGenerateResponse
	if err := json.NewDecoder(resp.Body).Decode(&data); err != nil {
		return ChatMessage{}, fmt.Errorf("gemini: decode response: %w", err)
	}
	if len(data.Candidates) == 0 {
		return ChatMessage{Role: "assistant", Content: ""}, nil
	}

	parts := data.Candidates[0].Content.Parts
	return ChatMessage{
		Role:      "assistant",
		Content:   extractGeminiText(parts),
		ToolCalls: normalizeGeminiToolCalls(parts),
	}, nil
}

func (p *GeminiProvider) ChatStream(ctx context.Context, messages []ChatMessage, sessionID, model string, reasoning bool, tools []ToolSchema) (<-chan StreamChunk, error) {
	if p.apiKey == "" {
		out := make(chan StreamChunk, 2)
		out <- StreamChunk{Content: "Error: No API Key configured for AI Studio."}
		out <- StreamChunk{Done: true}
		close(out)
		return out, nil
	}

	targetModel := p.targetModel(model)
	contents, systemInstruction := p.buildContents(messages)

	payload := geminiGenerateRequest{
		Contents: contents,
		Tools:    toGeminiTools(tools),
	}
	if systemInstruction != "" {
		payload.SystemInstruction = &geminiContent{Parts: []geminiPart{{Text: systemInstruction}}}
	}

	body, err := json.Marshal(payload)
	if err != nil {
		return nil, fmt.Errorf("gemini: marshal request: %w", err)
	}

	url := fmt.Sprintf("%s/models/%s:streamGenerateContent?alt=sse", p.baseURL, targetModel)
	req, err := p.newRequest(ctx, http.MethodPost, url, body)
	if err != nil {
		return nil, fmt.Errorf("gemini: build request: %w", err)
	}
	req.Header.Set("Accept", "text/event-stream")

	resp, err := p.httpClient.Do(req)
	if err != nil {
		return nil, fmt.Errorf("gemini stream error: %w", err)
	}
	if resp.StatusCode != http.StatusOK {
		errText, _ := io.ReadAll(resp.Body)
		resp.Body.Close()
		return nil, fmt.Errorf("gemini stream error: %s", string(errText))
	}

	out := make(chan StreamChunk)
	go func() {
		defer close(out)
		defer resp.Body.Close()

		emittedThink := false

		scanner := bufio.NewScanner(resp.Body)
		scanner.Buffer(make([]byte, 0, 64*1024), 1024*1024)
		for scanner.Scan() {
			line := strings.TrimSpace(scanner.Text())
			if line == "" || !strings.HasPrefix(line, "data:") {
				continue
			}
			dataStr := strings.TrimSpace(strings.TrimPrefix(line, "data:"))
			if dataStr == "" || dataStr == "[DONE]" {
				continue
			}

			var chunk geminiGenerateResponse
			if err := json.Unmarshal([]byte(dataStr), &chunk); err != nil {
				select {
				case out <- StreamChunk{Err: fmt.Errorf("gemini: decode SSE chunk: %w", err)}:
				case <-ctx.Done():
				}
				return
			}
			if len(chunk.Candidates) == 0 {
				continue
			}

			for _, part := range chunk.Candidates[0].Content.Parts {
				if part.Text == "" {
					continue
				}
				var prefix string
				if part.Thought {
					if !emittedThink {
						prefix = thinkOpen
						emittedThink = true
					}
				} else if emittedThink {
					prefix = thinkClose
					emittedThink = false
				}
				select {
				case out <- StreamChunk{Content: prefix + part.Text}:
				case <-ctx.Done():
					return
				}
			}
		}

		if err := scanner.Err(); err != nil {
			select {
			case out <- StreamChunk{Err: fmt.Errorf("gemini: read stream: %w", err)}:
			case <-ctx.Done():
			}
			return
		}

		if emittedThink {
			select {
			case out <- StreamChunk{Content: thinkClose}:
			case <-ctx.Done():
				return
			}
		}

		out <- StreamChunk{Done: true}
	}()

	return out, nil
}

func (p *GeminiProvider) AnalyzeLogs(ctx context.Context, template string, samples []string) (AnalysisResult, error) {
	if p.apiKey == "" {
		return AnalysisResult{Summary: "No API Key"}, nil
	}

	prompt := "You are a Log Analysis Specialist. Return JSON with 'summary', 'root_cause', 'recommended_actions'.\n\n" +
		"Cluster template: " + template + "\nSample logs:\n" + strings.Join(samples, "\n")

	payload := geminiGenerateRequest{
		Contents:         []geminiContent{{Role: "user", Parts: []geminiPart{{Text: prompt}}}},
		GenerationConfig: &geminiGenerationConfig{ResponseMIMEType: "application/json"},
	}
	body, err := json.Marshal(payload)
	if err != nil {
		return AnalysisResult{}, fmt.Errorf("gemini: marshal request: %w", err)
	}

	url := fmt.Sprintf("%s/models/%s:generateContent", p.baseURL, p.targetModel(""))
	req, err := p.newRequest(ctx, http.MethodPost, url, body)
	if err != nil {
		return AnalysisResult{}, fmt.Errorf("gemini: build request: %w", err)
	}

	resp, err := p.httpClient.Do(req)
	if err != nil {
		return AnalysisResult{Summary: "Analysis failed", RootCause: err.Error()}, nil
	}
	defer resp.Body.Close()

	if resp.StatusCode != http.StatusOK {
		errText, _ := io.ReadAll(resp.Body)
		return AnalysisResult{Summary: "Analysis failed", RootCause: string(errText)}, nil
	}

	var data geminiGenerateResponse
	if err := json.NewDecoder(resp.Body).Decode(&data); err != nil {
		return AnalysisResult{Summary: "Analysis failed", RootCause: err.Error()}, nil
	}
	if len(data.Candidates) == 0 {
		return AnalysisResult{Summary: "Analysis failed", RootCause: "no candidates returned"}, nil
	}

	text := extractGeminiText(data.Candidates[0].Content.Parts)
	var result AnalysisResult
	if err := json.Unmarshal([]byte(text), &result); err != nil {
		return AnalysisResult{Summary: "Analysis failed", RootCause: err.Error()}, nil
	}
	return result, nil
}

func (p *GeminiProvider) TestConnection(ctx context.Context) error {
	if p.apiKey == "" {
		return fmt.Errorf("no API key provided")
	}
	if !strings.HasPrefix(p.apiKey, "AIza") {
		return fmt.Errorf("invalid key format: Google AI Studio keys typically start with 'AIza'; " +
			"check if you are using a Vertex AI or Google Cloud key by mistake")
	}

	models, err := p.ListModels(ctx)
	if err != nil {
		return fmt.Errorf("connection failed: %w", err)
	}
	if len(models) == 0 || (len(models) == 1 && models[0] == DefaultGeminiModel) {
		return fmt.Errorf("connected but could not fetch models; this usually means the API key is valid " +
			"but the 'Generative Language API' is not enabled in your Google Cloud project")
	}
	return nil
}
