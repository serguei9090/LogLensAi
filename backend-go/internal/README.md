# internal

## Overview
Internal domain, storage, ingestion, clustering, query, RPC, and AI subsystems for the `loglensai/backend-go` sidecar module.

## Subdirectories & Boundaries
- `ai`: [./ai/README.md](./ai/README.md) — Phase 3 AI composition root (`Wire`, `Extra`), dynamic LLM provider adaptation, lazy RAG wiring, and extra AI/RAG/knowledge RPC handlers.
- `app`: [./app/README.md](./app/README.md) — Application composition root (`App`), lifecycle ownership, Laya cluster triager, and JSON-RPC domain handler implementations.
- `db`: [./db/README.md](./db/README.md) — DuckDB persistence layer, WAL recovery, schema/migrations, default settings seeding, ingestion batch writes, clustering batch updates, and DuckDB-VSS setup.
- `drain3`: [./drain3/README.md](./drain3/README.md) — Go port of the Drain3 prefix-tree log template miner, regex masker, LRU cache, facet extractor, and JSON persistence.
- `ingestion`: [./ingestion/README.md](./ingestion/README.md) — Local file tailing, remote SSH tailing, syslog UDP / HTTP `/ingest` listeners, shared-source fan-out deduplication, and batch ingestion.
- `metadata`: [./metadata/README.md](./metadata/README.md) — Timestamp (`strptime`), severity level, HTTP CLF, and custom regex facet extraction from raw log entries.
- `query`: [./query/README.md](./query/README.md) — LLQL lexer, recursive-descent parser, AST, and parameterized DuckDB SQL `WHERE` compiler.
- `rpc`: [./rpc/README.md](./rpc/README.md) — JSON-RPC 2.0 method registry, parameter validation, dispatch/panic recovery, stdio/HTTP transports, and `/api/stream_chat` SSE streaming.
- `services`: [./services/README.md](./services/README.md) — Disk-first `.log`/`.index` + mmap fast-path log store (`logstore`) and asynchronous train-then-tag clustering worker (`clustering`).
