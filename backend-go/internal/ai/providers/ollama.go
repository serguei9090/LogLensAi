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

// DefaultOllamaModel mirrors Python's DEFAULT_OLLAMA_MODEL.
const DefaultOllamaModel = "gemma4:e2b"

// ollamaReasoningDirective mirrors OllamaProvider.REASONING_DIRECTIVE.
const ollamaReasoningDirective = "You are a professional log analysis assistant. " +
	"For EVERY response, you MUST first conduct a deep reasoning phase. " +
	"You must start your reasoning with the token <|channel>thought and once you are " +
	"ready to give your final user-facing answer, you MUST output the token <|channel>text."

// OllamaProvider is a Go port of sidecar/src/ai/ollama.py's OllamaProvider:
// a local-HTTP provider talking to Ollama's native /api/chat, /api/tags and
// /api/generate endpoints.
type OllamaProvider struct {
	host         string
	model        string
	systemPrompt string
	httpClient   *http.Client
}

// NewOllamaProvider constructs an OllamaProvider. host defaults to
// "http://localhost:11434" and model to DefaultOllamaModel when empty,
// mirroring the Python constructor's defaults.
func NewOllamaProvider(host, systemPrompt, model string) *OllamaProvider {
	if host == "" {
		host = "http://localhost:11434"
	}
	if model == "" {
		model = DefaultOllamaModel
	}

	// Parity with Python: inject the reasoning directive when the caller
	// didn't supply their own system prompt and the model is known to use
	// inline channel-marker thinking.
	finalPrompt := systemPrompt
	if finalPrompt == "" && hasChannelMarkerThinking(model) {
		finalPrompt = ollamaReasoningDirective
	}

	return &OllamaProvider{
		host:         strings.TrimRight(host, "/"),
		model:        model,
		systemPrompt: finalPrompt,
		httpClient:   &http.Client{Timeout: 60 * time.Second},
	}
}

var _ Provider = (*OllamaProvider)(nil)

// --- wire types -------------------------------------------------------

type ollamaMessageWire struct {
	Role       string           `json:"role"`
	Content    string           `json:"content"`
	ToolCalls  []ollamaToolWire `json:"tool_calls,omitempty"`
	ToolCallID string           `json:"tool_call_id,omitempty"`
	Name       string           `json:"name,omitempty"`
}

type ollamaToolWire struct {
	ID       string                 `json:"id,omitempty"`
	Function ollamaToolFunctionWire `json:"function"`
}

type ollamaToolFunctionWire struct {
	Name      string          `json:"name"`
	Arguments json.RawMessage `json:"arguments,omitempty"`
}

type ollamaChatRequest struct {
	Model    string              `json:"model"`
	Messages []ollamaMessageWire `json:"messages"`
	Stream   bool                `json:"stream"`
	Tools    []openAIToolWire    `json:"tools,omitempty"`
	Options  map[string]float64  `json:"options,omitempty"`
}

type ollamaChatResponseMessage struct {
	Content   string           `json:"content"`
	Thinking  string           `json:"thinking"`
	Thought   string           `json:"thought"`
	ToolCalls []ollamaToolWire `json:"tool_calls"`
}

type ollamaChatResponse struct {
	Message ollamaChatResponseMessage `json:"message"`
	Done    bool                      `json:"done"`
}

type ollamaTagsResponse struct {
	Models []struct {
		Name string `json:"name"`
	} `json:"models"`
}

type ollamaGenerateRequest struct {
	Model  string `json:"model"`
	Prompt string `json:"prompt"`
	Stream bool   `json:"stream"`
	Format string `json:"format"`
}

type ollamaGenerateResponse struct {
	Response string `json:"response"`
}

// --- helpers ------------------------------------------------------------

func normalizeOllamaToolCalls(calls []ollamaToolWire) []ToolCall {
	if len(calls) == 0 {
		return nil
	}
	out := make([]ToolCall, 0, len(calls))
	for i, c := range calls {
		id := c.ID
		if id == "" {
			id = fmt.Sprintf("call_%d", i)
		}
		args := c.Function.Arguments
		if len(args) == 0 {
			args = json.RawMessage(`{}`)
		}
		out = append(out, ToolCall{ID: id, Name: c.Function.Name, Arguments: args})
	}
	return out
}

func denormalizeToOllamaToolCalls(calls []ToolCall) []ollamaToolWire {
	if len(calls) == 0 {
		return nil
	}
	out := make([]ollamaToolWire, 0, len(calls))
	for _, c := range calls {
		out = append(out, ollamaToolWire{
			ID: c.ID,
			Function: ollamaToolFunctionWire{
				Name:      c.Name,
				Arguments: c.Arguments,
			},
		})
	}
	return out
}

// formatMessages builds the Ollama /api/chat message list, mirroring
// OllamaProvider._format_messages: assistant history has thinking markers
// stripped, and the reasoning-directive system prompt is suppressed when
// the caller explicitly asked for reasoning=false.
func (p *OllamaProvider) formatMessages(messages []ChatMessage, reasoning bool) []ollamaMessageWire {
	out := make([]ollamaMessageWire, 0, len(messages)+1)

	systemContent := p.systemPrompt
	if !reasoning && systemContent == ollamaReasoningDirective {
		systemContent = ""
	}
	if systemContent != "" {
		out = append(out, ollamaMessageWire{Role: "system", Content: systemContent})
	}

	for _, m := range messages {
		content := m.Content
		if m.Role == "assistant" {
			content = cleanThinkingMarkers(content)
		}
		wire := ollamaMessageWire{Role: m.Role, Content: content}
		if len(m.ToolCalls) > 0 {
			wire.ToolCalls = denormalizeToOllamaToolCalls(m.ToolCalls)
		}
		if m.Role == "tool" {
			wire.ToolCallID = m.ToolCallID
			wire.Name = m.Name
		}
		out = append(out, wire)
	}
	return out
}

// --- Provider implementation ---------------------------------------------

func (p *OllamaProvider) ListModels(ctx context.Context) ([]string, error) {
	req, err := http.NewRequestWithContext(ctx, http.MethodGet, p.host+"/api/tags", nil)
	if err != nil {
		return nil, fmt.Errorf("ollama: build list models request: %w", err)
	}
	resp, err := p.httpClient.Do(req)
	if err != nil {
		return nil, fmt.Errorf("ollama: list models request: %w", err)
	}
	defer resp.Body.Close()

	if resp.StatusCode != http.StatusOK {
		return nil, fmt.Errorf("ollama: list models returned HTTP %d", resp.StatusCode)
	}

	var data ollamaTagsResponse
	if err := json.NewDecoder(resp.Body).Decode(&data); err != nil {
		return nil, fmt.Errorf("ollama: decode tags response: %w", err)
	}

	models := make([]string, 0, len(data.Models))
	for _, m := range data.Models {
		models = append(models, m.Name)
	}
	return models, nil
}

func (p *OllamaProvider) Chat(ctx context.Context, messages []ChatMessage, sessionID, model string, reasoning bool, tools []ToolSchema) (ChatMessage, error) {
	targetModel := model
	if targetModel == "" {
		targetModel = p.model
	}
	if targetModel == "" {
		targetModel = DefaultOllamaModel
	}

	payload := ollamaChatRequest{
		Model:    targetModel,
		Messages: p.formatMessages(messages, reasoning),
		Stream:   false,
		Tools:    toOpenAIToolsWire(tools),
	}

	body, err := json.Marshal(payload)
	if err != nil {
		return ChatMessage{}, fmt.Errorf("ollama: marshal request: %w", err)
	}

	req, err := http.NewRequestWithContext(ctx, http.MethodPost, p.host+"/api/chat", bytes.NewReader(body))
	if err != nil {
		return ChatMessage{}, fmt.Errorf("ollama: build request: %w", err)
	}
	req.Header.Set("Content-Type", "application/json")

	resp, err := p.httpClient.Do(req)
	if err != nil {
		// Parity with Python: connection failures surface as an assistant
		// message rather than a Go error, so a chat UI can render them
		// inline like any other reply.
		return ChatMessage{Role: "assistant", Content: "Ollama Connection Error: " + err.Error()}, nil
	}
	defer resp.Body.Close()

	if resp.StatusCode != http.StatusOK {
		errText, _ := io.ReadAll(resp.Body)
		return ChatMessage{Role: "assistant", Content: "Ollama Error: " + string(errText)}, nil
	}

	var data ollamaChatResponse
	if err := json.NewDecoder(resp.Body).Decode(&data); err != nil {
		return ChatMessage{}, fmt.Errorf("ollama: decode response: %w", err)
	}

	nativeThinking := data.Message.Thinking
	if nativeThinking == "" {
		nativeThinking = data.Message.Thought
	}

	toolCalls := normalizeOllamaToolCalls(data.Message.ToolCalls)

	if nativeThinking != "" {
		return ChatMessage{
			Role:      "assistant",
			Content:   wrapThinking(nativeThinking, data.Message.Content),
			ToolCalls: toolCalls,
		}, nil
	}

	return ChatMessage{
		Role:      "assistant",
		Content:   cleanThinkingMarkers(data.Message.Content),
		ToolCalls: toolCalls,
	}, nil
}

func (p *OllamaProvider) ChatStream(ctx context.Context, messages []ChatMessage, sessionID, model string, reasoning bool, tools []ToolSchema) (<-chan StreamChunk, error) {
	targetModel := model
	if targetModel == "" {
		targetModel = p.model
	}

	payload := ollamaChatRequest{
		Model:    targetModel,
		Messages: p.formatMessages(messages, reasoning),
		Stream:   true,
		Tools:    toOpenAIToolsWire(tools),
		Options:  map[string]float64{"temperature": 1.0, "top_p": 0.95, "top_k": 64},
	}

	body, err := json.Marshal(payload)
	if err != nil {
		return nil, fmt.Errorf("ollama: marshal request: %w", err)
	}

	req, err := http.NewRequestWithContext(ctx, http.MethodPost, p.host+"/api/chat", bytes.NewReader(body))
	if err != nil {
		return nil, fmt.Errorf("ollama: build request: %w", err)
	}
	req.Header.Set("Content-Type", "application/json")

	resp, err := p.httpClient.Do(req)
	if err != nil {
		return nil, fmt.Errorf("ollama stream error: %w", err)
	}

	if resp.StatusCode != http.StatusOK {
		errText, _ := io.ReadAll(resp.Body)
		resp.Body.Close()
		return nil, fmt.Errorf("ollama stream error: %s", string(errText))
	}

	out := make(chan StreamChunk)
	go func() {
		defer close(out)
		defer resp.Body.Close()

		// emittedThink tracks whether we're mid <think> block, mirroring
		// ThinkingStreamParser's native-thinking handling in Python. Full
		// inline channel-marker buffering (the Gemma-4 no-native-field
		// case) is intentionally not ported here — see package doc.
		emittedThink := false

		scanner := bufio.NewScanner(resp.Body)
		scanner.Buffer(make([]byte, 0, 64*1024), 1024*1024)
		for scanner.Scan() {
			line := bytes.TrimSpace(scanner.Bytes())
			if len(line) == 0 {
				continue
			}

			var chunk ollamaChatResponse
			if err := json.Unmarshal(line, &chunk); err != nil {
				select {
				case out <- StreamChunk{Err: fmt.Errorf("ollama: decode stream chunk: %w", err)}:
				case <-ctx.Done():
				}
				return
			}

			nativeThinking := chunk.Message.Thinking
			if nativeThinking == "" {
				nativeThinking = chunk.Message.Thought
			}

			if nativeThinking != "" {
				var prefix string
				if !emittedThink {
					prefix = thinkOpen
					emittedThink = true
				}
				select {
				case out <- StreamChunk{Content: prefix + nativeThinking}:
				case <-ctx.Done():
					return
				}
			}

			if chunk.Message.Content != "" {
				var prefix string
				if emittedThink {
					prefix = thinkClose
					emittedThink = false
				}
				select {
				case out <- StreamChunk{Content: prefix + chunk.Message.Content}:
				case <-ctx.Done():
					return
				}
			}

			if chunk.Done {
				break
			}
		}

		if err := scanner.Err(); err != nil {
			select {
			case out <- StreamChunk{Err: fmt.Errorf("ollama: read stream: %w", err)}:
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

func (p *OllamaProvider) AnalyzeLogs(ctx context.Context, template string, samples []string) (AnalysisResult, error) {
	prompt := "You are a Log Analysis Specialist. " +
		"Return JSON with 'summary', 'root_cause', 'recommended_actions'.\n\n" +
		"Cluster template: " + template + "\nSample logs:\n" + strings.Join(samples, "\n")

	targetModel := p.model
	if targetModel == "" {
		targetModel = DefaultOllamaModel
	}

	payload := ollamaGenerateRequest{
		Model:  targetModel,
		Prompt: prompt,
		Stream: false,
		Format: "json",
	}
	body, err := json.Marshal(payload)
	if err != nil {
		return AnalysisResult{}, fmt.Errorf("ollama: marshal request: %w", err)
	}

	req, err := http.NewRequestWithContext(ctx, http.MethodPost, p.host+"/api/generate", bytes.NewReader(body))
	if err != nil {
		return AnalysisResult{}, fmt.Errorf("ollama: build request: %w", err)
	}
	req.Header.Set("Content-Type", "application/json")

	resp, err := p.httpClient.Do(req)
	if err != nil {
		return AnalysisResult{Summary: "Analysis failed", RootCause: err.Error()}, nil
	}
	defer resp.Body.Close()

	if resp.StatusCode != http.StatusOK {
		return AnalysisResult{Summary: "Analysis failed", RootCause: fmt.Sprintf("Ollama returned status %d", resp.StatusCode)}, nil
	}

	var data ollamaGenerateResponse
	if err := json.NewDecoder(resp.Body).Decode(&data); err != nil {
		return AnalysisResult{Summary: "Analysis failed", RootCause: err.Error()}, nil
	}

	var result AnalysisResult
	if data.Response == "" {
		return result, nil
	}
	if err := json.Unmarshal([]byte(data.Response), &result); err != nil {
		return AnalysisResult{Summary: "Analysis failed", RootCause: err.Error()}, nil
	}
	return result, nil
}

func (p *OllamaProvider) TestConnection(ctx context.Context) error {
	client := &http.Client{Timeout: 5 * time.Second}
	req, err := http.NewRequestWithContext(ctx, http.MethodGet, p.host+"/api/tags", nil)
	if err != nil {
		return err
	}
	resp, err := client.Do(req)
	if err != nil {
		return fmt.Errorf("could not connect to Ollama at %s: %w", p.host, err)
	}
	defer resp.Body.Close()

	if resp.StatusCode != http.StatusOK {
		return fmt.Errorf("Ollama returned status %d", resp.StatusCode)
	}
	return nil
}
