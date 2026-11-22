# Scripts (`scripts`)

## Overview
Operational, diagnostic, schema-generation, database-maintenance, and developer-bootstrap scripts for LogLensAi (plus captured Gemini model-listing text outputs in `all_models.txt`, `output.txt`, and `output_utf8.txt`). Subdirectories contain Drain3/DuckDB throughput benchmarks and git hook agent triggers.

## Interface
- **Subdirectories**:
  - [Drain3 Benchmarks](./drain3/README.md) — Drain3 template mining, metadata extraction, multiprocess tagging, and DuckDB bulk-insert benchmarks (`process_apache_logs`, `process_apache_logs_pro`, `step1_baseline_read`–`step6_multiprocess_tagging`, `insert_executemany`, `insert_pandas`, `insert_arrow`).
  - [Git Hook Agent Triggers](./hooks/README.md) — Post-commit `gemini` CLI agent dispatcher (`AGENTS`, `run_command`, `get_changed_files`, `get_log_file`, `trigger_agent`, `main`).
- `[clean-sidecar.ps1]`: Top-level PowerShell script that terminates processes matching `*sidecar/main.py*` or `*LogLensAi-sidecar*`, kills listeners on TCP ports `5000`, `5001`, and `514`, and deletes stale WAL files (`loglens.duckdb.wal`, `src-tauri/loglens_tauri.duckdb.wal`).
- `[db_inspector.py:PROJECT_ROOT]`, `[db_inspector.py:DB_PATH]`, `[db_inspector.py:LOG_DIR]`: Module constants resolving `<cwd>/data/loglens.duckdb` and `<cwd>/scripts/logs`.
- `[db_inspector.py:ensure_log_dir]`: Creates `LOG_DIR` if missing.
- `[db_inspector.py:get_db_inspector]`: Connects read-only (`access_mode: read_only`) to `DB_PATH`, collects metrics across 10 DuckDB tables (`logs`, `clusters`, `log_sources`, `folders`, `log_streams`, `workspace_settings`, `settings`, `temporal_offsets`, `fusion_configs`, `ai_sessions`), and optionally (`verbose=True`) includes `log_sources` rows and up to 5 sample `logs` rows per workspace.
- `[db_inspector.py:main]`: CLI entry point supporting `-v`/`--verbose` and `-o`/`--output`, writing JSON reports to `scripts/logs/`.
- `[generate_schema.py:generate_schema]`: Imports 29 Pydantic request/response models from `sidecar/src/models.py`, builds a combined JSON Schema via `models_json_schema`, rewrites `$defs` to `definitions` with top-level `anyOf` and `title`, and writes `api_schema.json`.
- `[heldb_query.py:DB_PATH]`: Module constant `<cwd>/data/loglens.duckdb`.
- `[heldb_query.py:run_diagnostic]`: Connects read-only to `DB_PATH` and returns counts, columns, up to 5 sample rows, and per-workspace/source/setting breakdowns across 14 DuckDB tables.
- `[ingest_test_logs.py:ingest_file]`: Reads a text log file in 500-line batches (`source_id="test-ingestion"`, `level="INFO"`) and sends `ingest_logs` JSON-RPC 2.0 `POST` requests to `http://localhost:5000/rpc` (invoked directly from `__main__` with `"i:/server.log"`).
- `[inspect_db.py:SIDE_CAR_DIR]`, `[inspect_db.py:PROJECT_ROOT]`, `[inspect_db.py:DB_PATH]`: Module constants resolving `data/loglens.duckdb` relative to `__file__`'s parent directory.
- `[inspect_db.py:get_db_info]`: Connects read-only to `DB_PATH` and summarizes workspace log counts, `workspace_settings`, `log_sources`, `folders`, `clusters`, and a `UNION` of `workspace_id` values across all four tables.
- `[setup-gemini-hot.ps1]`: Top-level PowerShell script that clones or pulls `https://github.com/google-gemini/gemini-cli.git` into `./gemini-cli` and runs `npm install` and `npm run build`.
- `[start-gemini-hot.ps1]`: Top-level PowerShell script that configures `GEMINI_MODEL`/`GEMINI_CLI_MODEL` (`gemini-2.5-flash`), `CODER_AGENT_PORT` (`22436`), and local session storage (`../gemini_sessions/chat_back`), verifies `../gemini-cli/packages/a2a-server` exists, and launches `npm start`.
- `[verify_ai_studio.py:load_env]`: Parses `.env` in cwd or `../.env` and populates `os.environ` with non-comment `KEY=VALUE` pairs.
- `[verify_ai_studio.py:test_prefixes]`: Instantiates `google.genai.Client(api_key=os.environ.get("GOOGLEAI_API"))` and tests `generate_content` with `"Ping"` against `gemini-2.5-flash` and `gemma-4-31b-it`, both unprefixed and prefixed with `"models/"`.
- `[wipe_db_logs.py:PROJECT_ROOT]`, `[wipe_db_logs.py:DB_PATH]`: Module constants resolving `<cwd>/data/loglens.duckdb`.
- `[wipe_db_logs.py:wipe_logs]`: Opens `DB_PATH` read-write (after interactive `y/N` confirmation unless `--force` is passed via `argparse`), deletes all rows from `logs`, `log_sources`, `clusters`, `log_streams`, `anomalies`, `ingestion_jobs`, `ai_messages`, and `ai_sessions`, and runs `CHECKPOINT`.

## Invariants
- `[db_inspector.py:DB_PATH]`, `[heldb_query.py:DB_PATH]`, `[wipe_db_logs.py:DB_PATH]`, `[clean-sidecar.ps1]`, `[generate_schema.py]`, `[setup-gemini-hot.ps1]`: Resolve relative paths against `os.getcwd()` / current shell directory and assume execution from the repository root (`inspect_db.py` resolves relative to `__file__`, and `start-gemini-hot.ps1` resolves relative to `$PSScriptRoot`).
- `[db_inspector.py:get_db_inspector]`, `[heldb_query.py:run_diagnostic]`, `[inspect_db.py:get_db_info]`: Open DuckDB strictly in `read_only=True` mode; `[db_inspector.py:get_db_inspector]` and `[inspect_db.py:get_db_info]` close `conn` in `finally`, whereas `[heldb_query.py:run_diagnostic]` skips `conn.close()` if an unhandled exception exits before the loop completes.
- `[wipe_db_logs.py:wipe_logs]`: Deletes only the 8 transient/log tables in `tables_to_wipe` while preserving workspace and settings tables, and requires no exclusive DuckDB lock from the running app/sidecar.
- `[generate_schema.py:generate_schema]`: Prepends `<cwd>/sidecar/src` to `sys.path` and requires `sidecar/src/models.py` (with all 29 imported Pydantic model symbols) and `pydantic.json_schema.models_json_schema`.
- `[ingest_test_logs.py:ingest_file]`: Assumes an active sidecar HTTP JSON-RPC server at `http://localhost:5000/rpc` and hardcodes `"i:/server.log"` when run as `__main__`.
- `[clean-sidecar.ps1]`: Windows-only (`Get-CimInstance Win32_Process`, `Get-NetTCPConnection`) with `-ErrorAction SilentlyContinue`.
- `[start-gemini-hot.ps1]`: Requires `../gemini-cli/packages/a2a-server` (exits with code `1` otherwise) and pins `CODER_AGENT_PORT = "22436"`.
- `[verify_ai_studio.py:test_prefixes]`: Requires `GOOGLEAI_API` in `.env`, `../.env`, or the process environment.

## Side Effects
- `[clean-sidecar.ps1]`: Force-terminates matching processes and listeners on ports `5000`, `5001`, and `514`, deletes `loglens.duckdb.wal` and `src-tauri/loglens_tauri.duckdb.wal`, and writes to stdout.
- `[db_inspector.py:ensure_log_dir]`, `[db_inspector.py:main]`: Reads `data/loglens.duckdb`, creates `scripts/logs/`, writes timestamped or custom JSON files under `scripts/logs/`, and prints summary output.
- `[generate_schema.py:generate_schema]`: Mutates `sys.path` at import time and overwrites `api_schema.json` in cwd (invoked by `bun run type-sync` in `package.json`).
- `[heldb_query.py:run_diagnostic]`, `[inspect_db.py:get_db_info]`: Read `data/loglens.duckdb` and write JSON diagnostics to stdout.
- `[ingest_test_logs.py:ingest_file]`: Reads local log files, sends HTTP `POST` requests to `http://localhost:5000/rpc` mutating sidecar log storage, sleeps `0.1`s between 500-line batches, and prints responses.
- `[setup-gemini-hot.ps1]`: Clones/pulls `gemini-cli` from GitHub over the network, installs npm packages, and builds `./gemini-cli`.
- `[start-gemini-hot.ps1]`: Mutates environment variables, creates `../gemini_sessions/chat_back` if missing, and starts the local A2A Node server (`npm start`) on port `22436`.
- `[verify_ai_studio.py:load_env]`, `[verify_ai_studio.py:test_prefixes]`: Reads `.env`/`../.env`, mutates `os.environ`, sends live `generate_content` API calls to Google GenAI, and prints results.
- `[wipe_db_logs.py:wipe_logs]`: Prompts `stdin` when `force=False`, deletes all rows from 8 tables in `data/loglens.duckdb`, executes `CHECKPOINT`, and prints progress.

## Verification
- Run: `N/A` (no automated test suite targets `scripts/`; inspect CLI flags with `uv run scripts/db_inspector.py --help` and `uv run scripts/wipe_db_logs.py --help`, or run schema generation via `bun run type-sync` when `sidecar/src/models.py` is present).
