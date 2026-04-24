---
command: /self-evolve
description: Autonomous 4-phase framework growth (Audit, Architect, Optimize, Expand).
---

Assume Role: Orchestra Hub (@scribe)

# /self-evolve: Strategic Growth Workflow

This workflow represents the highest-level meta-process for the Antigravity framework. It evolves the system across four phases.

## Phase 1: Contextual Audit & Critique
**Assume Role:** Audit Smith (@audit)
// turbo
1. **List Assets**: Use `list_dir` recursively on `.agents/` and `.gemini/`.
2. **Review Logs & Telemetry**: Examine `docs/track/TODO.md` and `docs/track/telemetry.csv` for patterns in task failures, token friction, or slow executions.
3. **Critique**: Identify specific rules or skills that feel "Low Signal," "High Token Cost," or "Obstructive." Write findings in `docs/evolution/evolution_drift.md`.

## Phase 2: Architectural Refinement
1. **Structure Check**: Verify if the `workflow/`, `.agents/`, and `docs/track/` folders are effectively reducing context-loading costs.
2. **Path Refactor**: If the project has shifted (e.g., from Web to Mobile), update all rule/workflow paths to match.
3. **Cleanse**: Remove any newly identified legacy remains or redundant skill directories.

## Phase 3: Behavioral Optimization (Fine-tuning)
1. **Subagent Tune**: Analyze subagent instructions in `.gemini/agents/`.
2. **Rule Sharpening**: For every rule in `.agents/rules/`, ensure it has an `always_on`, `glob`, or `manual` trigger that is context-efficient.
3. **Instruction Update**: "Fine-tune" the Antigravity main context by updating `README.md` or a `system_prompt` update if applicable.

## Phase 4: Skill & Subagent Expansion
1. **Capability Identification**: Based on user requests, identify if a NEW skill is needed (e.g., if the user asks for "Cloud Deployments," create a `deploy-skill`).
2. **Bootstrap New Skills**: Use `skill-creator` to satisfy emerging needs (e.g., specialized testing, remote deployment).
3. **Usage-Aware Adaptation**: If the project grows into a specific domain (e.g., eBPF, React, Python), evolve specialized subagent profiles in `.gemini/agents/` to handle domain-specific constraints.

## Phase 5: Telemetry-Driven Optimization
1. **Analyze Efficiency**: Focus on "Token-Per-Function" and "Duration-Per-Action" metrics.
2. **Refactor High-Cost Context**: If a specific rule or skill is consistently driving high token usage without corresponding success, refactor it for "Token Density" (higher signal per token).
3. **Persist the Optimization**: Log the results of the evolution session back into `docs/track/telemetry.csv` using the `telemetry-logger` skill.

## 🚨 Mandatory Quality Standards
- **Assume Role Header**: Every file you create or edit MUST start with an `Assume Role: <Persona> (@handle)` header.
- **Semantic Commenting**: 
  - Every function MUST include a purpose, the architectural rationale, and a `Ref:` to the relevant spec file.
  - Every non-trivial variable MUST have an inline comment explaining **WHY** it exists.
- **TODO(ID) Protocol**: Any incomplete logic MUST use the strict syntax: 
  `// TODO(ID): [WHAT] ... [WHY] ... [EXPECTATION] ... [CONTEXT] See docs/track/specs/ID.md`
