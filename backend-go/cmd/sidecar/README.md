# sidecar

## Overview
Executable entrypoint for the LogLensAi Go backend sidecar. Parses CLI flags, initializes the `app.App` runtime and DuckDB handle, registers all JSON-RPC 2.0 handlers (including optional AI and AI-extra endpoints when AI wiring succeeds), and serves requests over JSON-RPC stdio or HTTP (`:5000` by default).

## Interface
- `[main.go:version]`: Package constant `"0.1.0"` reported by `--version`.
- `[main.go:main]`: CLI entrypoint accepting `--stdio` (default mode), `--http`, `--dev` (alias for `--http`), `--port` (default `5000`), `--db` (default `"loglens.duckdb"`), `--with-http` (runs background HTTP server alongside stdio), and `--version`.

## Invariants
- `[main.go:main]`: Must initialize `app.NewApp(*dbPath)` and defer `application.Close()` before registering or serving RPC endpoints; core startup fails fatally via `log.Fatalf` if `app.NewApp` errors.
- `[main.go:main]`: Core RPC handlers (`rpc.RegisterStubs`, `rpc.RegisterApp`, `rpc.RegisterSettingsMethods`, `rpc.RegisterHierarchyMethods`, `rpc.RegisterLogOpsMethods`) are always registered, whereas `ai.Wire` and `ai.NewExtra` are optional and degrade gracefully (logging a warning and skipping `rpc.RegisterAI` / `rpc.MountStreamChat` or `rpc.RegisterAIExtraMethods` on failure).
- `[main.go:main]`: When `aiWiring != nil`, every HTTP server path (`--http`/`--dev` or `--with-http`) mounts both `rpc.NewHTTPHandler(registry)` and `rpc.MountStreamChat` (`/api/stream_chat`).
- `[main.go:main]`: Passing `--version` prints the version string and exits before opening the database or binding any server.

## Side Effects
- `[main.go:main]`: Reads CLI flags, opens and closes the DuckDB database file at `--db` via `app.NewApp` / `application.Close`, and prints diagnostics or version output to stdout/stderr.
- `[main.go:main]`: Reads/writes `os.Stdin` and `os.Stdout` in stdio mode (`rpc.RunStdio`), or binds a TCP HTTP server on `127.0.0.1:<port>` via `http.ListenAndServe` (in a background goroutine when `--with-http` is used).

## Verification
- Run: `go test ./...`
