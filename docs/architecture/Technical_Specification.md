# Technical Specification: Antigravity AI Agentic Workflow Engine

## Executive Summary
**Antigravity** is a meta-orchestration framework designed to transform a standard codebase into an autonomous "Software Factory." It utilizes a multi-persona architecture (The Triad: Antigravity, Gemini CLI, Jules CLI) to execute hierarchical development tasks with built-in validation gates, 3-strike self-healing logic, and environment-aware hardware abstraction.

## Core Requirements
### Functional
- **Multi-Persona Execution**: Ability to assume specialized roles (@pm, @engineer, @qa, @devops) with distinct goals and constraints.
- **Workflow Orchestration**: Slash-command integration for complex, recurring task chains (e.g., `/auto-cycle`, `/adapt-project`).
- **Autonomous Recovery**: Built-in logic for self-healing syntax and dependency errors before human intervention.
- **Portability**: The ability to migrate the framework to any new project and self-calibrate via the `/adapt-project` workflow.

### Non-Functional
- **Zero-Hallucination Spec-First Architecture**: Mandatory "Approval Gates" between planning and execution.
- **Deterministic Tooling**: Standardized use of `uv` (Python), `bun` (JS/TS), and `lefthook` (Hooks).
- **Auditability**: Comprehensive telemetry and task-tracking (`TODO(ID)` and `telemetry.csv`).

## Architecture & Tech Stack
- **Engine**: Antigravity (LLM Orchestrator).
- **Local Surgeon**: Gemini CLI (Subagents in `.gemini/agents/`).
- **Remote Engineer**: Jules CLI (Asynchronous Refactoring).
- **Standards Layer**: `.agents/rules/` (Architectural Guardrails).
- **Skill Layer**: `.agents/skills/` (Operational Intelligence).

## State Management & Tracking
- **Primary Task Tracker**: `docs/track/TODO.md`.
- **Deep Task Memory**: `docs/TODOC/<unique_id>.md`.
- **Environment State**: `agents.yaml` and `scripts/hal-check.ps1`.
