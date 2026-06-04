# LogLensAi: High-Performance Log Analysis Cockpit

LogLensAi is a state-of-the-art diagnostic tool designed for high-velocity log ingestion and clustering. Built on the **Obsidian Lens** design system, it provides developers with a sleek, premium interface for deep-diving into millions of logs with zero latency.
## This is a personal learning project created for educational purposes and to explore different code concepts with ai concepts. 

* **Status:** Personal sandbox / Portfolio piece.
* **License:** This project is open-source and available for public educational use under the MIT License.
* **Purpose:** Academic research and technical skill development.

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

## 📂 Documentation & Project Map

| Area | Location | Description |
| :--- | :--- | :--- |
| **Core Mandates** | [GEMINI.md](./GEMINI.md) | Mandatory standards, styles, and AI subagent rules. |
| **Interaction Map** | [interaction_map.md](./docs/architecture/interaction_map.md) | Bridges Frontend stores with Backend JSON-RPC API. |
| **API Contract** | [communication.md](./docs/architecture/communication.md) | JSON-RPC 2.0 schema and bridging protocols. |
| **Persistence** | [database.md](./docs/architecture/database.md) | DuckDB schema and log storage strategy. |
| **Living Specs** | [docs/track/](./docs/track/) | Active feature plans, handoffs, and retrospectives. |

### Directory Breakdown
- `.agents/`: AI-Native rules, skills, and workflows.
- `.gemini/`: Subagent personas and configurations.
- `docs/architecture/`: Permanent architectural records (ADRs).
- `src/`: React Frontend (Atomic Design: Atoms, Molecules, Organisms).
- `sidecar/src/`: Python Logic, RPC Dispatcher, and DuckDB Engine.
- `src-tauri/`: Rust shell for desktop integration and window mgmt.

## 🚀 Getting Started

### 1. Prerequisites
- **Node.js**: [Bun](https://bun.sh) recommended.
- **Python**: [uv](https://github.com/astral-sh/uv) required.
- **Rust**: Latest stable (for Tauri).

### 2. Setup
```bash
# Install frontend dependencies
bun install

# Setup backend sidecar (automatic via uv)
cd sidecar && uv sync && cd ..

# Start development (Starts Vite + Sidecar)
bun run tauri dev
```
