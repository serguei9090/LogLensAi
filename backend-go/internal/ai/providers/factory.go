package providers

import "fmt"

// Config bundles the construction parameters common to every provider,
// mirroring the **kwargs (api_key, system_prompt, model, host, settings)
// that Python's AIProviderFactory.get_provider() accepts.
type Config struct {
	APIKey       string
	SystemPrompt string
	Model        string
	Host         string
}

// NewProvider mirrors Python's AIProviderFactory.get_provider(): given a
// provider name, construct the concrete Provider with the right defaults.
//
// Deviations from Python's factory:
//   - "gemini-cli" is not registered (GeminiCLIProvider was intentionally
//     not ported — see the doc comment on GeminiProvider in gemini.go).
//     Python's factory also silently falls back to GeminiCLIProvider for
//     any *unrecognized* provider name; this Go port instead returns an
//     error for unknown names, which is the more idiomatic (and less
//     surprising) behavior for a typed backend.
//   - The Python factory also injects a hard-coded "A2UI v0.9" UI-markup
//     system-prompt suffix into every provider's system_prompt. That is a
//     UI-protocol concern belonging to the tool-registry/state-machine
//     layer (which owns what instructions get glued onto the system
//     prompt), not to the provider construction layer — so it is not
//     duplicated here. Callers that want it should append it to
//     Config.SystemPrompt themselves.
func NewProvider(providerName string, cfg Config) (Provider, error) {
	switch providerName {
	case "ollama":
		host := cfg.Host
		if host == "" {
			host = "http://localhost:11434"
		}
		return NewOllamaProvider(host, cfg.SystemPrompt, cfg.Model), nil

	case "openai":
		host := cfg.Host
		if host == "" {
			host = DefaultOpenAIHost
		}
		model := cfg.Model
		if model == "" {
			model = DefaultOpenAIModel
		}
		return NewOpenAICompatibleProvider(cfg.APIKey, cfg.SystemPrompt, host, model), nil

	case "openai-compatible":
		host := cfg.Host
		if host == "" {
			host = "http://localhost:1234/v1"
		}
		model := cfg.Model
		if model == "" {
			model = "gpt-4o"
		}
		return NewOpenAICompatibleProvider(cfg.APIKey, cfg.SystemPrompt, host, model), nil

	case "openrouter":
		host := cfg.Host
		if host == "" {
			host = "https://openrouter.ai/api/v1"
		}
		model := cfg.Model
		if model == "" {
			model = "anthropic/claude-3.5-sonnet"
		}
		return NewOpenAICompatibleProvider(cfg.APIKey, cfg.SystemPrompt, host, model), nil

	case "lmstudio":
		host := cfg.Host
		if host == "" {
			host = "http://localhost:1234/v1"
		}
		return NewOpenAICompatibleProvider(cfg.APIKey, cfg.SystemPrompt, host, cfg.Model), nil

	case "ai-studio", "gemini":
		model := cfg.Model
		if model == "" {
			model = "gemini-2.5-flash"
		}
		return NewGeminiProvider(cfg.APIKey, cfg.SystemPrompt, model), nil

	default:
		return nil, fmt.Errorf("providers: unknown provider %q", providerName)
	}
}
