# Gemini CLI: Headless & JSON Reference

This document captures the official technical specification for interacting with the `gemini` CLI in non-interactive (headless) environments.

## 🚀 Headless Execution
Headless mode provides a programmatic interface to Gemini CLI, returning structured text or JSON output without an interactive terminal UI.

### Trigger Mechanism
Headless mode is triggered automatically when:
1.  The CLI is run in a non-TTY environment (e.g., Docker, subprocess, CI/CD).
2.  A query is provided with the `-p` (or `--prompt`) flag.

## 📦 Output Formats
Control the output structure using the `-o` or `--output-format` flag.

### 1. JSON Output (`--output-format json`)
Returns a single JSON object containing the response and usage statistics.

**Schema**:
- `response`: (string) The model’s final answer.
- `stats`: (object) Token usage and API latency metrics.
- `error`: (object, optional) Error details if the request failed.

### 2. Streaming JSON (`--output-format stream-json`)
Returns a stream of newline-delimited JSON (JSONL) events. Useful for real-time UI updates.

**Event Types**:
- `init`: Session metadata (session ID, model).
- `message`: User and assistant message chunks.
- `tool_use`: Tool call requests with arguments.
- `tool_result`: Output from executed tools.
- `error`: Non-fatal warnings and system errors.
- `result`: Final outcome with aggregated statistics.

## 🚦 Exit Codes
Use these codes for robust error handling in the sidecar:
- **`0`**: Success.
- **`1`**: General error or API failure.
- **`42`**: Input error (invalid prompt or arguments).
- **`53`**: Turn limit exceeded.

## 🛠️ Usage Examples

**Text Response (Simple)**:
```bash
gemini -p "Explain the architecture of this codebase"
```

**JSON Response (For Parsing)**:
```bash
gemini -p "Analyze these logs" --output-format json
```

**Streaming (For Real-time Monitoring)**:
```bash
gemini -p "Run tests and deploy" --output-format stream-json
```

**Specific Model**:
```bash
gemini -m gemini-2.5-flash
```
