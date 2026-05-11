# LogLensAi - Project Memory

## 📑 Table of Contents
- [Global Project Standards](c:/users/ascc/.gemini/gemini.md) — Mandatory architecture and tooling standards.
- [Project Architecture](./docs/architecture/gemini.md) — Detailed system design, personas, and engine environment.
- [System Interaction Map](./docs/architecture/interaction_map.md) — High-level bridge between Frontend stores and Sidecar API.
- [Design Standards](./DESIGN.md) — UI/UX specifications and design tokens.

## 🏗️ Core Architecture (Sidecar Standard)
LogLensAi strictly follows the **Sidecar Architecture** for desktop web-app reliability.

- **Frontend**: React 19 (TypeScript) + Vite 6 + Tailwind 4. Hosted in a Tauri v2 (Rust) desktop shell.
- **Backend (Sidecar Engine)**: Python 3.12 managed via `uv`. Located in `sidecar/src/`.
- **Communication Bridge**: JSON-RPC 2.0 protocol. 
    - **Desktop Mode**: Rust-interposed `stdin/stdout` via `src-tauri/src/sidecar.rs`.
    - **Web Mode**: Direct HTTP fetch to `localhost:5000`.
    - **Hook**: `src/lib/hooks/useSidecarBridge.ts` (Handles transport switching).
- **API Contract**: All sidecar actions must be implemented as `method_` in the `App` class within `sidecar/src/api.py`.

## 🛠️ Key Technologies & Tooling
- **Log Processing**: Drain3 for template mining and clustering (`sidecar/src/parser.py`).
- **Persistence**: DuckDB for logs/settings (`sidecar/src/db.py`) and SQLite for AI session state.
- **AI Orchestration**: Google ADK 2.0 + LangGraph. 'Hybrid Runner' supports Ollama, Gemini, and OpenAI.
- **Package Management**: `uv` (Python), `bun` (JS/TS), `cargo` (Rust).
- **Quality Control**: `ruff` (Python lint/format), `biome` (JS/TS lint/format), `lefthook` (Pre-commit).
- **Testing**: `pytest` (Sidecar), `vitest` (Frontend).

## 📊 Data Flow & Ingestion
1. **Ingestion**: Multi-source support (Files, SSH, Syslog, HTTP) via `sidecar/src/ingestion.py`.
2. **Metadata**: Regex-based extraction of timestamps, log levels, and custom facets.
3. **Clustering**: Drain3 maps raw lines to templates and cluster IDs.
4. **Storage**: Final structured records are persisted in DuckDB for high-performance querying.
5. **Querying**: Custom **LLQL** (Log Lens Query Language) parsed into DuckDB-compatible SQL.

## 🤖 Gemini CLI Subagent Creation Standards

All subagents for this project must follow these official standards for consistent delegation and performance.

### 1. File Structure & Location
- **Format:** Markdown file (`.md`) with YAML frontmatter.
- **Project-Specific Location:** `.gemini/agents/<agent-slug>.md`.

### 2. Mandatory YAML Frontmatter
The file must start with triple-dash (`---`) frontmatter including:
- `name`: (String) Unique identifier slug (lowercase, numbers, hyphens, underscores only).
- `description`: (String) Concise explanation of expertise. **CRITICAL:** Use high-signal keywords to ensure reliable delegation.
- `model`: (Optional) Specific model (e.g., `gemini-2.0-flash`). Defaults to main session model.
- `tools`: (Optional) List of tools (e.g., `read_file`, `replace`). Supports wildcards: `*`, `mcp_*`.
- `max_turns`: (Optional) Turn limit (default 30).

### 3. System Prompt (Markdown Body)
- Everything after the frontmatter is the subagent's System Prompt.
- Define a clear persona, specific constraints, and focused mission aligned with LogLensAi's architecture.

### 4. Operational Constraints
- **No Recursion**: Subagents cannot call other subagents.
- **Tool Isolation**: Only grant the tools strictly necessary for the subagent's domain.
- **Verification**: Always verify a subagent's functionality after creation by attempting a delegation.

## ⚙️ Sidecar API Best Practices
All API methods implemented in `sidecar/src/api.py` must strictly adhere to the following JSON-RPC 2.0 standards:

### 1. Method Naming Convention
- All methods must follow the snake_case convention.
- Methods exposed to the frontend must be prefixed with `api_` (e.g., `api_ingest_logs`).

### 2. Request Format
Requests from the frontend must strictly follow this structure:
```json
{
  "jsonrpc": "2.0",
  "method": "api_methodName",
  "params": {
    "param1": "value1",
    "param2": 123
  },
  "id": 12345
}
```

### 3. Response Format
Responses from the backend must strictly follow this structure:
```json
{
  "jsonrpc": "2.0",
  "result": {
    "data": "...",
    "metadata": "..."
  },
  "id": 12345
}
```

### 4. Error Handling
All errors must strictly follow this structure:
```json
{
  "jsonrpc": "2.0",
  "error": {
    "code": -32600,
    "message": "Invalid Request",
    "data": "Detailed error information"
  },
  "id": 12345
}
```

### 5. Validation
- All methods must implement strict parameter validation using Pydantic models.
- Return 400 Bad Request for invalid parameters.
- Return 500 Internal Server Error for unexpected issues.

Prefer MCP-server over chrome tool for app test check screenshot etc. MCP server is more reliable and efficient for app test check screenshot etc.

## 🚀 Architectural Benchmarks & Findings
- **Drain3 Performance (Single-Threaded):** Through rigorous benchmarking, we have proven that `drain3` running on a *single Python thread* can process and extract parameters at over **81,000 lines per second**.
- **Mandate:** **Do not use `ProcessPoolExecutor` or multiprocessing for Drain3 clustering.** The inter-process communication (IPC) and pickling overhead of passing large string batches to worker processes is significantly slower than single-threaded execution in RAM. All ingestion and clustering pipelines must process logs sequentially in memory *before* bulk-inserting into DuckDB.