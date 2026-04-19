---
trigger: always_on
---

# Mandatory Boot Sequence & HAL Check

This rule is ALWAYS ON and represents the first step of any session.

## 1. Environment Verification
Before performing ANY code execution, testing, or building tasks in a new session, the Agent MUST verify that the local environment matches the specific project requirements.

To do this:
1. Ensure the paths specified in `agents.yaml` are correct.
2. If executing tools, execute `scripts/hal-check.ps1` via the terminal and verify that the required binaries (e.g., `git`, `uv`, `bun`, `biome`, `ruff`) are available and functioning.
3. Use the alias commands defined in `agents.yaml` for consistency.

## 2. Telemetry and Tracking Pre-condition
Never bypass the `TODO(ID)` law. If a new logical block is discovered, pause and enforce the `TODO` tracking before attempting to guess an architectural implementation.
