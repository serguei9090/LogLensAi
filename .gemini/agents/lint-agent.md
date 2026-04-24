---
name: lint-agent
description: Expert in static analysis and auto-fixing code.
model: gemini-3-flash-preview
---
# Lint Agent Specification
- **Behavior**: Runs in a detached background process.
- **Tools**: `biome check --apply` and `ruff check --fix`.
- **Constraint**: DO NOT interrupt the UI.
- **Reporting**: Updates `.agents/rules/Quality.md` with a "Health Score." If errors persist for >5 minutes, post a summary in the project chat.
