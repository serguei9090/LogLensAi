---
name: adk-expert
description: Specialized skill for Google Agent Development Kit (ADK) 2.0 (Alpha) orchestration. Use this for building AI agents, graph-based workflows, and multi-tool diagnostic systems in the LogLensAi sidecar.
---

# ADK Expert: AI Orchestration Skill

Provides expert guidance for integrating Google Agent Development Kit (ADK) 2.0 into the LogLensAi ecosystem.

## 🎯 When to Use
- **New AI Agent Creation**: When creating a new AI-powered analysis or search routine.
- **Workflow Orchestration**: When defining complex, multi-step log diagnostic graphs.
- **Tool Integration**: When connecting existing Python methods or DuckDB queries as agent "Skills."
- **Debugging ADK**: When troubleshooting import errors, session persistence, or planner behavior.

## 🛠️ Core Components

| Component | Responsibility | Relevant Files |
| :--- | :--- | :--- |
| **`LlmAgent`** | The reasoning heart. Handles instructions, tools, and models. | `.agents/skills/adk-expert/references/adk-2.0-patterns.md#1-minimal-agent-definition` |
| **`Runner`** | Orchestrates agent execution and session flow. | `.agents/skills/adk-expert/references/adk-2.0-patterns.md#3-session--runner-execution` |
| **`SessionService`** | Manages conversation state and persistence (DuckDB by default). | `sidecar/src/db.py` (for custom session table implementation) |
| **`BuiltInPlanner`** | Enables multi-step reasoning and thought processes. | `.agents/skills/adk-expert/references/adk-2.0-patterns.md#1-minimal-agent-definition` |

## 📐 Tool Design Best Practices

ADK 2.0 automatically generates tool schemas from Python docstrings.

- **Use Detailed Docstrings**: Always include `Args`, `Returns`, and a clear function summary.
- **Type Hinting**: All parameters MUST have type hints (e.g., `(msg: str) -> dict`).
- **Input Validation**: Leverage Pydantic models for complex inputs if needed.

## 📄 Implementation Protocol

1. **Define the Goal**: What specific log analysis or search is the agent performing?
2. **Select the Model**: Default to `gemini-2.0-flash` for speed or `gemini-2.0-pro` for reasoning.
3. **Draft Instructions**: Write a concise, high-signal system prompt.
4. **Identify Tools**: Reuse existing `DB` or `Parser` methods from `sidecar/src/`.
5. **Set up the Runner**: Ensure it's integrated with the sidecar's session management.

## 🚀 Transitioning to ADK 2.0
Older `google-generativeai` implementations should be phased out in favor of the graph-based `google-adk` approach to permit future multi-agent collaboration.
