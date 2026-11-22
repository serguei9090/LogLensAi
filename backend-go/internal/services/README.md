# services

## Overview
Core background and storage service packages supporting disk-first log persistence, mmap-backed fast-path reads, and asynchronous Drain3 log clustering.

## Subdirectories & Boundaries
- `clustering`: [./clustering/README.md](./clustering/README.md) - Background train-then-tag batch worker pulling unprocessed logs from DuckDB, hydrating missing lines, extracting metadata, updating Drain3 trees, and persisting cluster results.
- `logstore`: [./logstore/README.md](./logstore/README.md) - Disk-first append-only `.log`/`.index` store with bounded per-source hot buffers and memory-mapped O(1) line hydration.
