package providers

import "encoding/json"

// openAIToolWire is the OpenAI-function-calling wire shape for advertising
// tools, i.e. exactly what `sidecar/src/ai/tools.py`'s
// ToolRegistry.get_tool_schemas() produces. Both Ollama's /api/chat
// endpoint and any OpenAI-compatible /v1/chat/completions endpoint accept
// this same shape verbatim (Python's ollama.py passes the `tools` list
// straight through unmodified), so the encoder is shared here.
type openAIToolWire struct {
	Type     string             `json:"type"`
	Function openAIFunctionWire `json:"function"`
}

type openAIFunctionWire struct {
	Name        string          `json:"name"`
	Description string          `json:"description"`
	Parameters  json.RawMessage `json:"parameters"`
}

// toOpenAIToolsWire converts normalized ToolSchema values into the
// OpenAI-function-calling wire format shared by Ollama and any
// OpenAI-compatible endpoint.
func toOpenAIToolsWire(tools []ToolSchema) []openAIToolWire {
	if len(tools) == 0 {
		return nil
	}
	out := make([]openAIToolWire, 0, len(tools))
	for _, t := range tools {
		params := t.Parameters
		if len(params) == 0 {
			params = json.RawMessage(`{}`)
		}
		out = append(out, openAIToolWire{
			Type: "function",
			Function: openAIFunctionWire{
				Name:        t.Name,
				Description: t.Description,
				Parameters:  params,
			},
		})
	}
	return out
}
