# Master AI Context: LogLensAi

LogLensAi is a **Flutter desktop application** (Windows/macOS/Linux) for professional log analysis. It uses a Go sidecar for heavy lifting (DuckDB storage, Drain3 log clustering, AI orchestration) and a Flutter/Dart frontend for the UI.

> **Migration note**: this app was originally built on Tauri v2 + React 19 + a Python sidecar. That stack was fully replaced by a Go backend + Flutter frontend on the `flutter` branch (old `sidecar/`, `src/`, `src-tauri/` directories removed). The JSON-RPC 2.0 contract between frontend and backend did not change — only its implementation language did. Full migration history: `docs/migration/STATUS.md`.

## 🗺️ Rule-Map (Laws of Physics)

- **Architecture**: `.agents/rules/System/Architecture.md` (Hexagonal + Ports/Adapters)
- **Software Standards**: `.agents/rules/System/SoftwareStandards.md` (DRY, KISS, SOLID)
- **Quality**: `.agents/rules/System/CodeQuality.md` (TODO(ID) + Atomic Design)
- **UI Design**: `.agents/rules/UI/AtomicDesignStandard.md` (Visual Hierarchy)
- **Docs First**: `.agents/rules/System/DocsFirst.md` (Mandatory documentation rule)
- **Design Standard**: `DESIGN.md` (Unified design tokens & rationale)
- **Intelligence**: `.agents/rules/System/IntelligenceStack.md` (AI Orchestration)

## 🎯 Product Scope (STRICT)

The **only active modules** are:

1. **Dashboard Page** — stat tiles, charts, AI-insights mode (`flutter_app/lib/pages/dashboard_page.dart`) — was a grayed-out placeholder in the pre-migration React app, now fully implemented as part of the Flutter rebuild
2. **Investigation Page** — the core log analysis view
3. **Settings Page** — AI provider + Drain3 config + general preferences

**Explicitly OUT of scope** (backlog only, no implementation):

- Metrics views beyond the existing Dashboard stat tiles / charts
- Multi-file merge

## 🏗️ Tech Stack

- **Frontend**: Flutter (Dart), desktop targets (Windows/macOS/Linux), Riverpod for state, `fl_chart` for charting
- **Communication**: JSON-RPC 2.0 — HTTP on port 5000 in dev, stdin/stdout in prod (unchanged from the old stack)
- **Backend Sidecar**: Go, DuckDB (`marcboeker/go-duckdb`), hand-ported Drain3 clustering, hand-written AI state machine + tool registry
- **Desktop Shell**: Flutter's own native desktop runner (no separate Rust shell)
- **Package Manager**: Go modules (`go.mod`) for the backend, `pub`/`flutter pub` for the frontend
- **Linter/Formatter**: `go vet` / `gofmt` (backend), `flutter analyze` / `dart format` (frontend)

### Pinned Versions (Reproduce with `go build ./...` in `backend-go/` + `flutter pub get` in `flutter_app/`)

| Layer | Package | Version |
|---|---|---|
| Runtime | Go | `1.26.4` |
| Runtime | Flutter SDK | `3.44.4` stable (Dart SDK `^3.12.2`) |
| Backend | `github.com/marcboeker/go-duckdb` | `v1.8.5` |
| Backend | `github.com/yalue/onnxruntime_go` | `v1.31.0` |
| Backend | `github.com/fsnotify/fsnotify` | `v1.10.1` |
| Backend | `github.com/google/uuid` | `v1.6.0` |
| Backend | `golang.org/x/crypto` | `v0.55.0` |
| Backend | `golang.org/x/text` | `v0.41.0` |
| Frontend | `flutter_riverpod` | `^2.6.1` |
| Frontend | `fl_chart` | `^0.69.2` |
| Frontend | `file_picker` | `^8.1.6` |
| Frontend | `window_manager` | `^0.4.3` |
| Frontend | `http` | `^1.2.2` |
| Frontend | `cupertino_icons` | `^1.0.8` |

Check `backend-go/go.mod` and `flutter_app/pubspec.yaml` for the authoritative, current version list — this table is a snapshot.

## 📁 Mandatory Folder Structure

```text
flutter_app/
  lib/
    theme/            ← DESIGN.md tokens ported verbatim (app_colors.dart, app_spacing.dart,
                         app_typography.dart, app_theme.dart) — ALL design tokens live here
    models/            ← Dart mirrors of the JSON-RPC contract (hand-written fromJson/toJson)
    services/
      sidecar_bridge.dart  ← dual-mode IPC (stdio subprocess default, HTTP :5000 fallback)
    providers/          ← Riverpod StateNotifiers, one per domain (workspace, investigation,
                         clustering, health, debug, ingestion, ai, fusion, settings, template,
                         distribution, dashboard, ui)
    widgets/
      atoms/            ← smallest units (StatusDot, LogLevelBadge, IconButton, TailSwitch)
      molecules/        ← composed atoms (SearchBar, FilterBuilder, ClusterRow, SourceItem)
      organisms/        ← full UI sections (LogToolbar, VirtualLogTable, Sidebar,
                         AIInvestigationSidebar, DashboardCharts)
    pages/               ← assembled views (DashboardPage, InvestigationPage, SettingsPage)
    app.dart             ← real 3-column app shell (Sidebar / main / DiagnosticSidebar)
    main.dart            ← entrypoint

backend-go/
  cmd/
    sidecar/           ← entrypoint (stdio + HTTP, mirrors the old sidecar/main.py)
    goldentest/         ← Python-vs-Go parity harness used during the migration
  internal/
    db/                 ← DuckDB schema, migrations, singleton/cursor mgmt (USE get_cursor()
                         patterns mirrored from the Python original)
    rpc/                 ← JSON-RPC 2.0 dispatch (HTTP :5000 + stdio), all 67 methods
    models/              ← request/response structs (from the original api_schema.json)
    drain3/              ← hand-ported Drain3 clustering algorithm
    query/                ← LLQL parser
    metadata/             ← timestamp/level/facet extraction
    ingestion/            ← file tailer, SSH tailer, syslog/HTTP listeners, shared-source dedup
    ai/
      providers/          ← Ollama / OpenAI-compatible / Gemini HTTP clients
      graph/               ← hand-written state machine (reasoning/tool_execution/final_answer)
      rag/                  ← DuckDB-VSS memory search, ONNX embeddings, Go WordPiece tokenizer
      wiring.go             ← reconciliation/adapter layer between the above packages
    services/
      clustering/          ← goroutine-based train-then-tag batch worker
      logstore/             ← disk-first append-only storage + mmap fast-path reads
    app/                   ← composition root (App struct) + handlers_*.go RPC wiring
```

## 🎨 Design System

- **Source of Truth**: `DESIGN.md` (Unified tokens for colors, typography, and spacing) — unchanged by the migration
- Dark theme: `#0D0F0E` base, `#22C55E` primary green accent
- **Hard rule**: No hardcoded hex in widget files. Use the `flutter_app/lib/theme/` tokens (`AppColors`, `AppSpacing`, `AppTypography`) only.

## ⚡ Boot Sequence (for AI agents)

2. Check `.agents/rules/` for constraints

## 🔌 JSON-RPC API Contract

All methods are called via `flutter_app/lib/services/sidecar_bridge.dart`. Never change the transport. The contract itself (method names, params, returns) is unchanged from the Python-era sidecar.

| Method | Params | Returns |
|---|---|---|
| `get_logs` | `{ workspace_id, offset, limit, filters, query, sort_by, sort_order }` | `{ total, logs[], offset, limit }` |
| `get_clustering_status`| `{ workspace_id }` | `{ mode, paused, backlog, ... }` |
| `set_clustering_mode` | `{ mode, workspace_id? }` | `{ status, mode, paused }` |
| `start_tail` | `{ filepath, workspace_id }` | `{ status }` |
| `ingest_logs` | `{ logs: IngestLogEntry[] }` | `{ status }` |
| `analyze_cluster` | `{ cluster_id, workspace_id }` | `{ summary, root_cause, recommended_actions[] }` |
| `send_ai_message` | `{ session_id, message, workspace_id }` | `{ response, session_id }` |
| `get_ai_sessions` | `{ workspace_id }` | `AiSession[]` |
| `get_anomalies` | `{ workspace_id, limit? }` | `Anomaly[]` |
| `get_settings` | `{}` | `Record<string,string>` |
| `update_settings` | `{ settings: Record<string,string> }` | `{ status }` |
| `factory_reset` | `{}` | `{ status, message }` |
| `get_health` | `{}` | `{ status, uptime, version }` |

All 67 methods are registered in `backend-go/internal/rpc/` (`RegisterStubs` + `RegisterApp`, called from `cmd/sidecar/main.go`); real implementations live under `backend-go/internal/app/handlers_*.go`.

## Golden Standards

- **Team Perspective (NEW)**: We are the new autonomous development team. We value precision, automation, and strict adherence to the defined architecture. We verify before we implement.
- **Markdown-Based Task Tracking (Single Source of Truth)**: All tasks, TODO checklists, sprint tracking, and specs MUST live strictly within local markdown files (specifically `docs/track/TODO.md` and detailed specifications in `docs/track/specs/<ID>.md`). 
    - **Precedence**: This rule takes absolute precedence over any contradictory instructions in `.agents/rules/` (e.g., legacy `bd` or `beads` systems).
    - **No DB Tasks**: Do not use, initialize, or depend on any database-backed task managers.
- **Contract → Interface → Mock → Impl**: define boundaries before writing logic
- **Flutter/Dart Standards**: Follow the widget-tier discipline in `.agents/rules/UI/AtomicDesignStandard.md` — Atoms stay stateless/store-free, Organisms own Riverpod provider access. Run `flutter analyze` before considering UI work done.
- **JSON Validation**: All JSON-RPC methods MUST validate inputs and produce outputs via typed Go structs in `internal/models/` (the Go analogue of the old Pydantic models).
- **Thread-safe Database**: every DuckDB query goes through `internal/db`'s cursor/connection helpers (the Go analogue of Python's `get_cursor()` discipline) for thread isolation.
- **Graceful Shutdown (Prod vs Dev)**:
  - **Dev**: The HTTP (`:5000`) listener must clean up the DuckDB connection on shutdown to prevent zombie processes and WAL locks.
  - **Prod**: The `stdin/stdout` loop must gracefully catch `EOF`/interrupt signals and properly close the DuckDB connection before exiting.
- **Testing (ADK Standard)**: Real code over mocks. Test public interface behavior. Fast and isolated tests. High coverage for edge cases. Backend: `go test ./...` from `backend-go/`. Frontend: `flutter test` from `flutter_app/`.
- **Conventional Commits**: ALL commits must follow the `feat|fix|refactor|docs|test|chore` format.
- **No silent gaps**: missing logic gets a `TODO(ID)` with a detail file in `docs/track/specs/`

## 🤖 Automated Development Pipeline (Jules)

When running `/smith_orchestra_auto`, Jules orchestrates work based on `docs/track/TODO.md`.

### Role Mapping & Responsibility

| Role | Responsibility | Primary Files |
|---|---|---|
| **@pm** | Roadmap & Logic Specs. Owns `TODO.md` and `specs/*.md`. | `docs/track/` |
| **@critique** | Investigative Root Cause & Solution Review. Audits all plans. | `docs/track/LessonsLearned.md` |
| **@backend** | Go sidecar, DB, & RPC logic. Ensures DuckDB connection/cursor safety. | `backend-go/internal/` |
| **@frontend** | Flutter UI, layout, & Riverpod state. Strictly follows `DESIGN.md`. | `flutter_app/lib/widgets/`, `flutter_app/lib/providers/` |
| **@qa** | Auditing & Bug Fixes. Manages `flutter test` and `go test`. | All codebase |
| **@devops** | Deployment, Packaging, & Automation Scripts. | `flutter_app/windows/`, `flutter_app/macos/`, `flutter_app/linux/`, `scripts/` |

### Working Protocol

1. **Context First**: Always read `AGENTS.md` and `docs/track/TODO.md` before starting.
2. **Spec Verification**: Before implementing a task, verify if its corresponding `docs/track/specs/<ID>.md` exists.
3. **Atomic Commits**: Implement one task (TODO ID) at a time, verify, and document in `docs/track/LessonsLearned.md`.
