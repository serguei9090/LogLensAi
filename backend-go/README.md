# backend-go

## Overview
Go 1.26.4 backend sidecar (`loglensai/backend-go`) providing DuckDB storage, disk-first log indexing and mmap hydration, Drain3 log clustering, LLQL querying, local/SSH/syslog/HTTP ingestion, Laya ONNX triage, RAG memory/knowledge vector retrieval, multi-provider LLM orchestration, and JSON-RPC 2.0 + SSE transports.

## Subdirectories & Boundaries
- `cmd`: [./cmd/README.md](./cmd/README.md) — Executable command entrypoints, including `sidecar` (`main.go`) serving JSON-RPC over stdio or HTTP.
- `internal`: [./internal/README.md](./internal/README.md) — Internal sidecar subsystems covering `ai`, `app`, `db`, `drain3`, `ingestion`, `metadata`, `query`, `rpc`, and `services`.
