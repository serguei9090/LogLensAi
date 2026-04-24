# LogLensAi: High-Performance Log Analysis Cockpit

LogLensAi is a state-of-the-art diagnostic tool designed for high-velocity log ingestion and clustering. Built on the **Obsidian Lens** design system, it provides developers with a sleek, premium interface for deep-diving into millions of logs with zero latency.

## 🏗️ Technical Architecture
- **Frontend**: Tauri v2, React 19, Vite, Zustand, TanStack Table (Virtualization).
- **Backend (Sidecar)**: Python 3.12+, DuckDB, Drain3.
- **Protocol**: JSON-RPC 2.0 over stdin/stdout.

## 🛠️ Tooling & Standards
- **JS Runtime**: [Bun](https://bun.sh)
- **Python Runtime**: [uv](https://github.com/astral-sh/uv)
- **Linting & Formatting**: 
  - [Biome](https://biomejs.dev) (Frontend)
  - [Ruff](https://astral.sh/ruff) (Backend)
- **Autonomy**: Triggered subagents via `lefthook` for linting (`@lint-agent`) and documentation (`@doc-agent`).

## 🌪️ Autonomy & Vibecoding
LogLensAi is developed using the **Jules-Cycle**:
1. **Spec**: Define target behavior in `docs/track/TODOC/`.
2. **Snapshot**: Atomic git commits of the specification.
3. **Execution**: `@jules-agent` generates Pure TDD tests and implementation code.
4. **Validation**: Auto-running unit tests and background autofix cycles.
5. **Review**: Architectural audit by `@reviewer-agent`.

## 📂 Project Structure
```text
.agents/         # AI-Native rules, skills, and workflows.
.gemini/         # Subagent personas and configurations.
docs/            # Living Specifications, ADRs, and Reports.
src/             # React Frontend (Atomic Design).
sidecar/         # Python Logic & DuckDB Engine.
```
