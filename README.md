# LogLensAi: High-Performance Log Analysis Cockpit

LogLensAi is a state-of-the-art diagnostic tool designed for high-velocity log ingestion and clustering. Built on the **Obsidian Lens** design system, it provides developers with a sleek, premium interface for deep-diving into millions of logs with zero latency.
## This is a personal learning project created for educational purposes and to explore different code concepts with ai concepts. 

* **Status:** Personal sandbox / Portfolio piece.
* **License:** This project is open-source and available for public educational use under the MIT License.
* **Purpose:** Academic research and technical skill development.

## 🏗️ Technical Architecture
- **Frontend**: Flutter (Dart), desktop targets (Windows/macOS/Linux), Riverpod, `fl_chart`.
- **Backend (Sidecar)**: Go 1.26+, DuckDB (`marcboeker/go-duckdb`), hand-ported Drain3.
- **Protocol**: JSON-RPC 2.0 — HTTP on port 5000 in dev, stdin/stdout in prod.

> Originally built on Tauri v2 + React 19 + a Python sidecar; fully migrated to Go + Flutter on the `flutter` branch. See `docs/migration/STATUS.md` for the migration record.

## 🛠️ Tooling & Standards
- **Go Toolchain**: [Go](https://go.dev) `1.26.4`
- **Flutter SDK**: [Flutter](https://flutter.dev) `3.44.4` stable
- **Linting & Formatting**: 
  - `flutter analyze` / `dart format` (Frontend)
  - `go vet` / `gofmt` (Backend)
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
- `docs/migration/`: Record of the Tauri/React/Python → Go/Flutter migration.
- `flutter_app/`: Flutter Frontend (Atomic Design: `lib/widgets/{atoms,molecules,organisms}`, `lib/pages/`).
- `backend-go/`: Go sidecar — RPC dispatcher (`internal/rpc/`), DuckDB engine (`internal/db/`), Drain3 clustering (`internal/drain3/`), AI orchestration (`internal/ai/`).

## 🚀 Getting Started

### 1. Prerequisites
- **Go**: [Go](https://go.dev) `1.26.4`+ required (backend).
- **Flutter**: [Flutter](https://flutter.dev) `3.44.4`+ stable, with desktop support enabled (`flutter config --enable-windows-desktop` / `--enable-macos-desktop` / `--enable-linux-desktop`).

### 2. Setup
```bash
# Build/run the Go sidecar (dev mode, HTTP on :5000)
cd backend-go
go build ./cmd/sidecar
./sidecar   # or: go run ./cmd/sidecar

# In a separate terminal, fetch Flutter deps and run the desktop app
cd flutter_app
flutter pub get
flutter run -d windows   # or -d macos / -d linux

# Production build (bundles the app; Flutter spawns the Go binary as a subprocess over stdio)
flutter build windows    # or: flutter build macos / flutter build linux
```
