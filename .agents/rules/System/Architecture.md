# Architecture Standards (LogLensAi)

## 1. MANDATORY: The Bridge Protocol (Law #1)
- **Universal Constraint**: All Flutter-to-Sidecar communication MUST use `sidecar_bridge.dart` (JSON-RPC 2.0).
- **Transport**: Stdio pipes in desktop production mode; direct HTTP fetch (`http://127.0.0.1:5000`) in dev mode.
- **Contract Integrity**: Every JSON-RPC method in `backend-go/internal/rpc/` MUST have corresponding typed Go request/response structs in `internal/models/` and Dart models in `flutter_app/lib/models/`.
- **Serialization**: Timestamps must be ISO-8601 strings; never pass raw vendor/driver date types unformatted across the bridge.

## 2. Ports and Adapters (Hexagonal Law)
- **Separation**: Business logic (`internal/drain3`, `internal/query`, `internal/ai`) MUST NOT depend directly on network transports or UI layers.
- **Port**: Define communication interfaces and repository ports in domain packages first.
- **Adapter**: Implement concrete adapters (`internal/rpc/`, `internal/db/`, `internal/ingestion/`) behind ports.

## 3. Persistence & DuckDB Data Safety
- **Cursor Isolation**: Every DuckDB query must go through `internal/db`'s cursor/connection helpers. Never share raw cursor instances across concurrent goroutines to avoid WAL locks.
- **Schema Authority**: Go models in `internal/models/` and schema migrations in `internal/db/` are the authoritative source of truth.

## 4. UI Structure & State Discipline
- **Widget Tier Hierarchy**: Follow Atomic Design (`atoms/` -> `molecules/` -> `organisms/` -> `pages/`). Atoms remain stateless with no Riverpod access. Organisms own Riverpod access.
- **Design Tokens**: Strictly use tokens from `flutter_app/lib/theme/` (`AppColors`, `AppSpacing`, `AppTypography`). Hardcoded hex colors are strictly forbidden.

## 5. Fast Code Intelligence (Codanna-First)
- Before checking callers or refactoring, run `codanna retrieve callers <Symbol>` or `codanna mcp analyze_impact <Symbol>`. Never perform brute-force multi-file reads.
