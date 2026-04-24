# LogLensAi - Project Memory

## 📑 Table of Contents
- [Global Project Standards](c:/users/ascc/.gemini/gemini.md) — Mandatory architecture and tooling standards.
- [Project Architecture](./docs/Documentation/architecture/gemini.md) — Detailed system design, personas, and engine environment.
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
