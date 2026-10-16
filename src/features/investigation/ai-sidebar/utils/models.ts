export const OPENROUTER_QUICK_FREE_MODELS = [
  { id: "openrouter/free", label: "Auto Free Router" },
  { id: "meta-llama/llama-3.3-70b-instruct:free", label: "Llama 3.3 70B" },
  { id: "deepseek/deepseek-r1:free", label: "DeepSeek R1" },
  { id: "deepseek/deepseek-chat:free", label: "DeepSeek V3" },
  { id: "google/gemini-2.0-flash-exp:free", label: "Gemini 2.0 Flash" },
  { id: "qwen/qwen-2.5-coder-32b-instruct:free", label: "Qwen 2.5 Coder" },
] as const;

export const AI_COMMANDS = [
  { cmd: "/search", label: "Search Memory", desc: "Search previously saved issues" },
  { cmd: "/save", label: "Save Memory", desc: "Force save the current context as memory" },
  { cmd: "/query", label: "Query Logs", desc: "Search across active workspace logs" },
  {
    cmd: "/analyze",
    label: "Analyze Cluster",
    desc: "Perform deep-dive analysis on a log pattern",
  },
  { cmd: "/anomalies", label: "Find Anomalies", desc: "Scan workspace for statistical outliers" },
  { cmd: "/create_column", label: "Create Column", desc: "Ask AI to create a custom column" },
  {
    cmd: "/create_facet",
    label: "Create Facet",
    desc: "Ask AI to extract a custom facet (mask)",
  },
] as const;
