# LogLensAi - Project Memory

## 📑 Table of Contents
- [Global Project Standards](c:/users/ascc/.gemini/gemini.md) — Mandatory architecture and tooling standards.
- [Project Architecture](./docs/architecture/gemini.md) — Detailed system design, personas, and engine environment.
- [System Interaction Map](./docs/architecture/interaction_map.md) — High-level bridge between Frontend stores and Sidecar API.
- [Design Standards](./DESIGN.md) — UI/UX specifications and design tokens.

## 🏗️ Core Architecture (Sidecar Standard)
LogLensAi strictly follows the **Sidecar Architecture** for desktop application reliability.

- **Frontend**: Flutter (Dart 3.x), Riverpod state management, desktop runner (Windows/macOS/Linux). Located in `flutter_app/`.
- **Backend (Sidecar Engine)**: Go 1.26 sidecar service. Located in `backend-go/`.
- **Communication Bridge**: JSON-RPC 2.0 protocol. 
    - **Desktop Mode**: Process-interposed `stdin/stdout` via `flutter_app/lib/services/sidecar_bridge.dart`.
    - **Web / Dev Mode**: Direct HTTP fetch to `http://127.0.0.1:5000`.
- **API Contract**: All sidecar actions are registered in `backend-go/internal/rpc/` and implemented in `backend-go/internal/app/handlers_*.go`.

## 🛠️ Key Technologies & Tooling
- **Log Processing**: Hand-ported Drain3 template mining & clustering (`backend-go/internal/drain3/`).
- **Persistence**: DuckDB (`marcboeker/go-duckdb`) for logs & settings (`backend-go/internal/db/`).
- **AI Orchestration**: Hand-written AI state machine (`backend-go/internal/ai/graph/`) + tool registry, supporting Ollama, OpenAI-compatible, and Gemini APIs.
- **Laya AI (System 1 Decision Engine)**:
  - Official GitHub: [NandhaKishorM/laya](https://github.com/NandhaKishorM/laya)
  - Base Model (Hugging Face): [convaiinnovations/laya](https://huggingface.co/convaiinnovations/laya)
  - Fine-Tuned Checkpoint: [Ankit1106/laya-typed-decisions](https://huggingface.co/Ankit1106/laya-typed-decisions)
  - Quantized 8-bit ONNX Model: [nvkudva/laya-web-q8](https://huggingface.co/nvkudva/laya-web-q8) (~524 MB, CPU/Zero-VRAM or GPU via `yalue/onnxruntime_go`)
  - Web Runtime / Parser: [nvkudva/laya-web](https://github.com/nvkudva/laya-web)
- **Code Intelligence**: **Codanna** AST indexer (`.codanna/index`). Use `codanna retrieve callers/calls/symbol` for instant symbol lookup without brute-force file scanning.
- **Package Management**: Go modules (`go.mod`) for backend, `pub`/`flutter pub` for frontend.
- **Quality Control**: `go vet`/`gofmt` (Go backend), `flutter analyze`/`dart format` (Flutter frontend).
- **Testing**: `go test ./...` (backend), `flutter test` (frontend).

## 📊 Data Flow & Ingestion
1. **Ingestion**: File tailing, SSH tailer, syslog/HTTP listeners via `backend-go/internal/ingestion/`.
2. **Metadata**: Regex-based extraction of timestamps, log levels, and custom facets via `backend-go/internal/metadata/`.
3. **Clustering**: Drain3 maps raw lines to templates and cluster IDs in in-memory worker batches.
4. **Storage**: Final structured records are persisted in DuckDB for high-performance columnar querying.
5. **Querying**: Custom **LLQL** (Log Lens Query Language) parsed into DuckDB-compatible SQL via `backend-go/internal/query/`.

## ⚙️ Sidecar API Best Practices
All API methods in `backend-go/internal/rpc/` and `backend-go/internal/app/` must strictly adhere to JSON-RPC 2.0 standards:

### 1. Method Registration & Naming
- All method names follow the snake_case convention (e.g. `get_logs`, `start_tail`, `analyze_cluster`).
- Registered in `backend-go/internal/rpc/` (`RegisterStubs` + `RegisterApp`) and dispatched cleanly to handlers.

### 2. Request & Response Format
- Requests and responses pass typed JSON-RPC 2.0 payloads via `flutter_app/lib/services/sidecar_bridge.dart` (stdio in desktop prod, HTTP `:5000` in dev).
- Input parameters and return results are strongly typed Go structs located in `backend-go/internal/models/`.

### 3. Error Handling
- Standard JSON-RPC 2.0 error codes (`-32600` Invalid Request, `-32601` Method Not Found, `-32602` Invalid Params, `-32603` Internal Error).
- DuckDB operations must always use the connection/cursor isolation helper in `backend-go/internal/db/` to prevent WAL locks.

### 4. Code Intelligence Integration (Codanna)
- Use `codanna retrieve` or `codanna mcp` for instant caller graph, blast radius, and symbol lookups before refactoring.
- Keep the local AST index fresh with `codanna index .` after adding or renaming exported structs, methods, or handlers.