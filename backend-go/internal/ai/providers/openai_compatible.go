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

// DefaultOpenAIHost mirrors OpenAICompatibleProvider's default host.
const DefaultOpenAIHost = "https://api.openai.com/v1"

// DefaultOpenAIModel mirrors the "gpt-4o" fallback used throughout
// AIProviderFactory/OpenAICompatibleProvider.
const DefaultOpenAIModel = "gpt-4o"

// OpenAICompatibleProvider is a Go port of
// sidecar/src/ai/openai_compatible.py's OpenAICompatibleProvider: works
// against OpenAI itself, LM Studio, or any other OpenAI-API-shaped
// endpoint (`/v1/chat/completions`, `/v1/models`).
type OpenAICompatibleProvider struct {
	host         string
	apiKey       string
	activeModel  string
	systemPrompt string
	httpClient   *http.Client
}

// NewOpenAICompatibleProvider constructs a provider. host defaults to
// DefaultOpenAIHost and model to DefaultOpenAIModel when empty. An empty
// apiKey is preserved as empty (no Authorization header sent) — Python
// substitutes "no-key-required" internally only to satisfy the OpenAI SDK
// client constructor, which this HTTP-based port has no need to mirror.
func NewOpenAICompatibleProvider(apiKey, systemPrompt, host, model string) *OpenAICompatibleProvider {
	if host == "" {
		host = DefaultOpenAIHost
	}
	if model == "" {
		model = DefaultOpenAIModel
	}
	return &OpenAICompatibleProvider{
		host:         strings.TrimRight(host, "/"),
		apiKey:       apiKey,
		activeModel:  model,
		systemPrompt: systemPrompt,
		httpClient:   &http.Client{Timeout: 60 * time.Second},
	}
}

var _ Provider = (*OpenAICompatibleProvider)(nil)

// --- wire types -----------------------------------------------------------

type openAIChatMessageWire struct {
	Role       string               `json:"role"`
	Content    string               `json:"content"`
	ToolCalls  []openAIToolCallWire `json:"tool_calls,omitempty"`
	ToolCallID string               `json:"tool_call_id,omitempty"`
	Name       string               `json:"name,omitempty"`
}

// openAIToolCallWire is OpenAI's tool_calls wire shape:
// `{"id", "type": "function", "function": {"name", "arguments": "<json-encoded string>"}}`.
type openAIToolCallWire struct {
	ID       string                     `json:"id"`
	Type     string                     `json:"type"`
	Function openAIToolCallFunctionWire `json:"function"`
}

type openAIToolCallFunctionWire struct {
	Name      string `json:"name"`
	Arguments string `json:"arguments"`
}

type openAIChatRequest struct {
	Model           string                  `json:"model"`
	Messages        []openAIChatMessageWire `json:"messages"`
	Tools           []openAIToolWire        `json:"tools,omitempty"`
	Stream          bool                    `json:"stream,omitempty"`
	ResponseFormat  *openAIResponseFormat   `json:"response_format,omitempty"`
	ReasoningEffort string                  `json:"reasoning_effort,omitempty"`
}

type openAIResponseFormat struct {
	Type string `json:"type"`
}

type openAIChatResponse struct {
	Choices []struct {
		Message struct {
			Content          string               `json:"content"`
			ReasoningContent string               `json:"reasoning_content,omitempty"`
			ToolCalls        []openAIToolCallWire `json:"tool_calls"`
		} `json:"message"`
	} `json:"choices"`
}

type openAIStreamChunkWire struct {
	Choices []struct {
		Delta struct {
			Content          string `json:"content"`
			ReasoningContent string `json:"reasoning_content"`
		} `json:"delta"`
	} `json:"choices"`
}

type openAIModelsResponse struct {
	Data   []map[string]any `json:"data"`
	Models []map[string]any `json:"models"`
}

// --- helpers ----------------------------------------------------------

func normalizeOpenAIToolCalls(calls []openAIToolCallWire) []ToolCall {
	if len(calls) == 0 {
		return nil
	}
	out := make([]ToolCall, 0, len(calls))
	for _, c := range calls {
		// OpenAI's `arguments` field is itself a JSON-*encoded string*
		// (e.g. `"{\"query\":\"foo\"}"`), so its raw bytes are already a
		// valid JSON object literal — no double-unmarshal needed.
		args := json.RawMessage(c.Function.Arguments)
		if len(args) == 0 {
			args = json.RawMessage(`{}`)
		}
		out = append(out, ToolCall{ID: c.ID, Name: c.Function.Name, Arguments: args})
	}
	return out
}

func denormalizeToOpenAIToolCalls(calls []ToolCall) []openAIToolCallWire {
	if len(calls) == 0 {
		return nil
	}
	out := make([]openAIToolCallWire, 0, len(calls))
	for _, c := range calls {
		args := string(c.Arguments)
		if args == "" {
			args = "{}"
		}
		out = append(out, openAIToolCallWire{
			ID:   c.ID,
			Type: "function",
			Function: openAIToolCallFunctionWire{
				Name:      c.Name,
				Arguments: args,
			},
		})
	}
	return out
}

func (p *OpenAICompatibleProvider) formatMessages(messages []ChatMessage) []openAIChatMessageWire {
	out := make([]openAIChatMessageWire, 0, len(messages)+1)
	if p.systemPrompt != "" {
		out = append(out, openAIChatMessageWire{Role: "system", Content: p.systemPrompt})
	}
	for _, m := range messages {
		wire := openAIChatMessageWire{Role: m.Role, Content: m.Content}
		if len(m.ToolCalls) > 0 {
			wire.ToolCalls = denormalizeToOpenAIToolCalls(m.ToolCalls)
		}
		if m.Role == "tool" {
			wire.ToolCallID = m.ToolCallID
			wire.Name = m.Name
		}
		out = append(out, wire)
	}
	return out
}

func (p *OpenAICompatibleProvider) authHeader(req *http.Request) {
	if p.apiKey != "" {
		req.Header.Set("Authorization", "Bearer "+p.apiKey)
	}
}

// --- Provider implementation -----------------------------------------------

func (p *OpenAICompatibleProvider) ListModels(ctx context.Context) ([]string, error) {
	req, err := http.NewRequestWithContext(ctx, http.MethodGet, p.host+"/models", nil)
	if err != nil {
		return nil, fmt.Errorf("openai-compatible: build request: %w", err)
	}
	p.authHeader(req)

	resp, err := p.httpClient.Do(req)
	if err != nil {
		return nil, fmt.Errorf("openai-compatible: request failed: %w", err)
	}
	defer resp.Body.Close()

	if resp.StatusCode != http.StatusOK {
		bodyBytes, _ := io.ReadAll(resp.Body)
		return nil, fmt.Errorf("openai-compatible: HTTP %d: %s", resp.StatusCode, strings.TrimSpace(string(bodyBytes)))
	}

	var data openAIModelsResponse
	if err := json.NewDecoder(resp.Body).Decode(&data); err != nil {
		return nil, fmt.Errorf("openai-compatible: decode response: %w", err)
	}

	items := data.Data
	if len(items) == 0 {
		items = data.Models
	}

	models := make([]string, 0, len(items))
	for _, m := range items {
		if id, ok := m["id"].(string); ok {
			models = append(models, id)
		} else if key, ok := m["key"].(string); ok {
			models = append(models, key)
		}
	}
	return models, nil
}

func (p *OpenAICompatibleProvider) Chat(ctx context.Context, messages []ChatMessage, sessionID, model string, reasoning bool, tools []ToolSchema) (ChatMessage, error) {
	targetModel := model
	if targetModel == "" {
		targetModel = p.activeModel
	}

	payload := openAIChatRequest{
		Model:    targetModel,
		Messages: p.formatMessages(messages),
		Tools:    toOpenAIToolsWire(tools),
	}
	if reasoning {
		payload.ReasoningEffort = "medium"
	}
	body, err := json.Marshal(payload)
	if err != nil {
		return ChatMessage{}, fmt.Errorf("openai-compatible: marshal request: %w", err)
	}

	req, err := http.NewRequestWithContext(ctx, http.MethodPost, p.host+"/chat/completions", bytes.NewReader(body))
	if err != nil {
		return ChatMessage{}, fmt.Errorf("openai-compatible: build request: %w", err)
	}
	req.Header.Set("Content-Type", "application/json")
	p.authHeader(req)

	resp, err := p.httpClient.Do(req)
	if err != nil {
		return ChatMessage{Role: "assistant", Content: "OpenAI Compatible Error: " + err.Error()}, nil
	}
	defer resp.Body.Close()

	if resp.StatusCode != http.StatusOK {
		errText, _ := io.ReadAll(resp.Body)
		return ChatMessage{Role: "assistant", Content: "OpenAI Compatible Error: " + string(errText)}, nil
	}

	var data openAIChatResponse
	if err := json.NewDecoder(resp.Body).Decode(&data); err != nil {
		return ChatMessage{}, fmt.Errorf("openai-compatible: decode response: %w", err)
	}
	if len(data.Choices) == 0 {
		return ChatMessage{Role: "assistant", Content: "OpenAI Compatible Error: empty choices"}, nil
	}

	msg := data.Choices[0].Message
	content := msg.Content
	if msg.ReasoningContent != "" {
		content = wrapThinking(msg.ReasoningContent, content)
	}

	return ChatMessage{
		Role:      "assistant",
		Content:   content,
		ToolCalls: normalizeOpenAIToolCalls(msg.ToolCalls),
	}, nil
}

func (p *OpenAICompatibleProvider) ChatStream(ctx context.Context, messages []ChatMessage, sessionID, model string, reasoning bool, tools []ToolSchema) (<-chan StreamChunk, error) {
	targetModel := model
	if targetModel == "" {
		targetModel = p.activeModel
	}

	payload := openAIChatRequest{
		Model:    targetModel,
		Messages: p.formatMessages(messages),
		Tools:    toOpenAIToolsWire(tools),
		Stream:   true,
	}
	if reasoning {
		payload.ReasoningEffort = "medium"
	}
	body, err := json.Marshal(payload)
	if err != nil {
		return nil, fmt.Errorf("openai-compatible: marshal request: %w", err)
	}

	req, err := http.NewRequestWithContext(ctx, http.MethodPost, p.host+"/chat/completions", bytes.NewReader(body))
	if err != nil {
		return nil, fmt.Errorf("openai-compatible: build request: %w", err)
	}
	req.Header.Set("Content-Type", "application/json")
	req.Header.Set("Accept", "text/event-stream")
	p.authHeader(req)

	resp, err := p.httpClient.Do(req)
	if err != nil {
		return nil, fmt.Errorf("openai-compatible stream error: %w", err)
	}
	if resp.StatusCode != http.StatusOK {
		errText, _ := io.ReadAll(resp.Body)
		resp.Body.Close()
		return nil, fmt.Errorf("openai-compatible stream error: %s", string(errText))
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
			if dataStr == "[DONE]" {
				break
			}

			var chunk openAIStreamChunkWire
			if err := json.Unmarshal([]byte(dataStr), &chunk); err != nil {
				select {
				case out <- StreamChunk{Err: fmt.Errorf("openai-compatible: decode SSE chunk: %w", err)}:
				case <-ctx.Done():
				}
				return
			}
			if len(chunk.Choices) > 0 {
				delta := chunk.Choices[0].Delta
				if delta.ReasoningContent != "" {
					var prefix string
					if !emittedThink {
						prefix = thinkOpen
						emittedThink = true
					}
					select {
					case out <- StreamChunk{Content: prefix + delta.ReasoningContent}:
					case <-ctx.Done():
						return
					}
				}
				if delta.Content != "" {
					var prefix string
					if emittedThink {
						prefix = thinkClose
						emittedThink = false
					}
					select {
					case out <- StreamChunk{Content: prefix + delta.Content}:
					case <-ctx.Done():
						return
					}
				}
			}
		}

		if err := scanner.Err(); err != nil {
			select {
			case out <- StreamChunk{Err: fmt.Errorf("openai-compatible: read stream: %w", err)}:
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

func (p *OpenAICompatibleProvider) AnalyzeLogs(ctx context.Context, template string, samples []string) (AnalysisResult, error) {
	prompt := "You are a Log Analysis Specialist. Return JSON with 'summary', 'root_cause', 'recommended_actions'.\n\n" +
		"Cluster template: " + template + "\nSample logs:\n" + strings.Join(samples, "\n")

	payload := openAIChatRequest{
		Model: p.activeModel,
		Messages: []openAIChatMessageWire{
			{Role: "user", Content: prompt},
		},
		ResponseFormat: &openAIResponseFormat{Type: "json_object"},
	}
	body, err := json.Marshal(payload)
	if err != nil {
		return AnalysisResult{}, fmt.Errorf("openai-compatible: marshal request: %w", err)
	}

	req, err := http.NewRequestWithContext(ctx, http.MethodPost, p.host+"/chat/completions", bytes.NewReader(body))
	if err != nil {
		return AnalysisResult{}, fmt.Errorf("openai-compatible: build request: %w", err)
	}
	req.Header.Set("Content-Type", "application/json")
	p.authHeader(req)

	resp, err := p.httpClient.Do(req)
	if err != nil {
		return AnalysisResult{Summary: "Analysis failed", RootCause: err.Error()}, nil
	}
	defer resp.Body.Close()

	if resp.StatusCode != http.StatusOK {
		errText, _ := io.ReadAll(resp.Body)
		return AnalysisResult{Summary: "Analysis failed", RootCause: string(errText)}, nil
	}

	var data openAIChatResponse
	if err := json.NewDecoder(resp.Body).Decode(&data); err != nil {
		return AnalysisResult{Summary: "Analysis failed", RootCause: err.Error()}, nil
	}
	if len(data.Choices) == 0 {
		return AnalysisResult{Summary: "Analysis failed", RootCause: "empty choices"}, nil
	}

	var result AnalysisResult
	if err := json.Unmarshal([]byte(data.Choices[0].Message.Content), &result); err != nil {
		return AnalysisResult{Summary: "Analysis failed", RootCause: err.Error()}, nil
	}
	return result, nil
}

func (p *OpenAICompatibleProvider) TestConnection(ctx context.Context) error {
	models, err := p.ListModels(ctx)
	if err != nil {
		return fmt.Errorf("connection failed: %w", err)
	}
	if len(models) == 0 {
		return fmt.Errorf("connected but no models found; check your API base URL")
	}
	return nil
}
