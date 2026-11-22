# cmd

## Overview
Executable command entrypoints for `backend-go`.

## Subdirectories & Boundaries
- `sidecar`: [./sidecar/README.md](./sidecar/README.md) - Sidecar binary entrypoint that boots `app.App`, registers core and optional AI JSON-RPC handlers, and runs stdio or HTTP transport.
