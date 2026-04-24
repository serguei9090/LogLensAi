# LogLensAi — Jules Environment Setup (Optimized for Snapshots)

> **Deployment Guide**: 
> 1. Copy the **Setup Script** below into the "Initial Setup" configuration in Jules.
> 2. Ensure the **Environment Variables** are set in the Jules UI.
> 3. Click **Run and Snapshot**.

---

## 🛠️ Setup Script
*This script uses Jules pre-installed tools (`uv`, `bun`, `python 3.12`) to prepare the container.*

```bash
#!/bin/bash
set -ex

echo "--- LogLensAi Snapshot Initialization ---"

# 1. Initialize Python Environment
echo "Installing Python dependencies..."
uv sync --all-extras --dev

# 2. Initialize Node Environment 
echo "Installing Node dependencies..."
bun install

# 3. Verification
uv --version && bun --version

# 4. Environment Verification
echo "Verifying Toolchain..."
uv --version
bun --version
python3 --version

echo "--- Setup Successful: Ready for Snapshot ---"
```

---

## 🔑 Environment Variables
*Required for runtime consistency.*

| Key | Value | Description |
|---|---|---|
| `NODE_ENV` | `development` | Enables dev-mode features |
| `PYTHONPATH` | `./sidecar/src` | Fixes sidecar module resolution |
| `DUCKDB_PATH` | `:memory:` | Recommended for stateless Jules tests/snapshots |

---

## 💡 Validation Tips
- The script **manually recreates the folder structure** defined in `AGENTS.md`. This is necessary because `747b7f5` is a clean genesis commit.
- `set -ex` ensures that the setup fails early if any command fails, preventing bad snapshots.
- After snapshotting, Jules will use this warm environment for every new session.
