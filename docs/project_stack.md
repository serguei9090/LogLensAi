# Project Stack: LogLensAi

The LogLensAi architecture is divided into three main layers: the Desktop Shell, the Sidecar Engine, and the AI Orchestration Layer.

## 1. Desktop Shell (Frontend)
- **Framework**: [React 19](https://react.dev/)
- **Runtime**: [Tauri v2](https://tauri.app/) (Rust-based shell)
- **Language**: TypeScript 5
- **Styling**: Vanilla CSS with Design Tokens in `DESIGN.md`
- **UI Components**: shadcn/ui (Tailwind-based primitives)
- **State Management**: [Zustand](https://docs.pmnd.rs/zustand/)
- **Virtualization**: [TanStack Virtual](https://tanstack.com/virtual/v3)
- **Build Tool**: [Vite](https://vitejs.dev/)
- **Package Manager**: [Bun](https://bun.sh/)

## 2. Sidecar Engine (Backend)
- **Language**: Python 3.12+
- **Persistence**: [DuckDB](https://duckdb.org/) (In-process analytical database)
- **Log Clustering**: [Drain3](https://github.com/logpai/Drain3)
- **HTTP Server**: [aiohttp](https://docs.aiohttp.org/)
- **RPC Protocol**: JSON-RPC 2.0
- **SSH Handling**: [Paramiko](https://www.paramiko.org/)
- **Environment Management**: [uv](https://github.com/astral-sh/uv)

## 3. AI Orchestration Layer
- **Orchestration**: [Google ADK](https://github.com/google-labs/google-adk) (A2UI streaming)
- **State Machine**: [LangGraph](https://www.langchain.com/langgraph) (Python)
- **Tool Safety**: [PydanticAI](https://pydantic-ai.com/)
- **Persistence**: SQLite (Checkpointers for LangGraph)
- **Reasoning**: Universal Middleware Parser (Custom implementation)

## 4. Quality & Tooling
- **Linting/Formatting**: Biome (JS/TS), Ruff (Python)
- **Git Hooks**: [Lefthook](https://github.com/evilmartians/lefthook)
- **Testing**: Vitest (Frontend), Pytest (Backend)
- **CI/CD**: Docker-centric workflows
