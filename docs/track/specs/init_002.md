# TODO: init_002
**Title:** Scaffold Python Sidecar Environment
**Status:** Pending

### The Contract (What)
Create the `sidecar/` directory, initialize it with `uv`, and write the placeholder logic for a JSON-RPC listener loop.

### The Rationale (Why)
The React app cannot process 1M log rows. It relies on a high-speed Python binary communicating via stdin/stdout. We must configure this boundary early.

### Execution Steps for the Subagent
1. Inside `sidecar/`, run `uv init`.
2. Ensure `duckdb`, `pydantic`, `pytest`, and `drain3` are installed via `uv add`.
3. Create `sidecar/main.py` containing a simple `while True:` loop that reads `sys.stdin` and writes to `sys.stdout` expecting JSON-RPC schema.
4. Create a basic failing `pytest` stub to follow the TDD rule.

### Definition of Done
`uv run pytest` executes and fails (or passes if stub is trivial), and `tauri.conf.json` is updated to mount the sidecar.
