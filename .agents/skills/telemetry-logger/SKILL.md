---
name: telemetry-logger
description: Specialized skill for logging session and task telemetry to measure the efficiency and performance of the AI Agentic Workflow.
---

# Telemetry Logger Skill

This skill captures and persists quantitative data about agent performance, enabling data-driven evolution and optimization of the Antigravity framework.

## 1. Logging Procedure

When a task is completed or a significant phase ends:

1.  **Collect Metrics**:
    - **Timestamp**: Current ISO format.
    - **TaskID**: The current high-level `TODO(ID)`.
    - **Agent**: (Antigravity/Gemini/Jules).
    - **Action**: (Refactor/Lint/Doc/Research/Debug).
    - **TokenUsage**: (Estimated Input + Output tokens).
    - **DurationSec**: (Time taken for the task if measurable).
    - **Success**: (True/False).

2.  **Append to CSV**: Use `run_command` to append the entry to `docs/track/telemetry.csv`.
    - Format: `Timestamp,TaskID,Agent,Action,TokenUsage,DurationSec,Success`

3.  **Reflect and Optimize**: Review `telemetry.csv` during the `/self-evolve` workflow to identify high-cost or slow actions and propose optimizations (e.g., prompt refinement or skill refactoring).

## 2. Best Practices

- **Consistency**: Always use the same format for `telemetry.csv` to ensure compatibility with data analysis tools.
- **Accuracy**: Provide realistic estimates for token usage and durations.
- **Traceability**: Ensure every telemetry entry is linked to a valid `TaskID`.
