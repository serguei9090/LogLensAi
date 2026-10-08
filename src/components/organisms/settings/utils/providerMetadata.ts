export const OPENROUTER_FREE_MODELS = [
  {
    id: "openrouter/free",
    label: "Auto Free Router",
    desc: "Routes automatically to best free model",
  },
  {
    id: "meta-llama/llama-3.3-70b-instruct:free",
    label: "Llama 3.3 70B",
    desc: "Meta flagship 70B",
  },
  { id: "deepseek/deepseek-r1:free", label: "DeepSeek R1", desc: "Reasoning model" },
  { id: "deepseek/deepseek-chat:free", label: "DeepSeek V3", desc: "General chat & code" },
  { id: "google/gemini-2.0-flash-exp:free", label: "Gemini 2.0 Flash", desc: "Google high-speed" },
  {
    id: "qwen/qwen-2.5-coder-32b-instruct:free",
    label: "Qwen 2.5 Coder 32B",
    desc: "Specialized coding",
  },
  {
    id: "mistralai/mistral-small-24b-instruct-2501:free",
    label: "Mistral Small 24B",
    desc: "Efficient 24B",
  },
] as const;

export function getProviderLabel(provider: string): string {
  if (provider === "openai") {
    return "OpenAI Official API";
  }
  if (provider === "openrouter") {
    return "OpenRouter Unified API";
  }
  if (provider === "ollama") {
    return "Local Inference";
  }
  if (provider === "ai-studio") {
    return "Google Cloud Native";
  }
  if (provider === "lmstudio") {
    return "Local App Inference";
  }
  return "Universal API";
}

export function getProviderDescription(provider: string): string {
  if (provider === "openai") {
    return "Direct connection to official OpenAI API infrastructure (GPT-4o, o1, o3-mini).";
  }
  if (provider === "openrouter") {
    return "Access Claude 3.5, Llama 3.3, Gemini 2.0, DeepSeek, and GPT-4o through OpenRouter.";
  }
  if (provider === "ollama") {
    return "Ensure Ollama is running and desired model is pulled locally.";
  }
  if (provider === "ai-studio") {
    return "Connect directly to Google's model infrastructure via API Key.";
  }
  if (provider === "lmstudio") {
    return "LM Studio local server. Ensure the server is started in the LM Studio SDK tab.";
  }
  return "Supports Azure, Groq, Perplexity, or any OpenAI-compatible proxy.";
}
