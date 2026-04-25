---
description: Autonomous framework growth and rule-sharpening engine.
---

# 🌀 Self-Evolution Engine (`/evolve`)
> **Assume Role:** `@arch-audit` (Architecture Audit)

This workflow targets the "IQ" of the agentic framework. It identifies technical friction, prunes low-signal rules, and expands agent capabilities based on real-world task performance.

---

## Phase 1: Friction & Drift Audit
**Assume Role:** `@arch-audit`
1. **Audit**: Execute `/ai-framework-audit` to identify drift in personas, workflows, or rules.
2. **Telemetry**: Analyze `docs/track/LessonsLearned.md` for recurring errors or environment friction.
3. **Pruning**: Identify "Low Signal" rules that cause token-bloat without adding reasoning value.

---

## Phase 2: Behavioral Sharpening
**Assume Role:** `@commander`
1. **Rule Refactor**: Use `rule-creator` to sharpen existing rules for "Token Density" (higher signal, fewer words).
2. **Persona Update**: Fine-tune subagent configurations in `.gemini/agents/` based on successful execution patterns.
3. **Workflow Optimization**: Merge or refactor workflows to reduce redundancy and improve "low-context" (Flash) compatibility.

---

## Phase 3: Capability Expansion
**Assume Role:** `@devops` (Script Smith)
1. **Skill Discovery**: Identify manual multi-step processes performed in recent sessions.
2. **Automation**: Use `skill-creator` to automate these patterns into modular skills.
3. **Integration**: Update the `SKILL.md` index and ensure workflows reference the new capabilities.

---

## Phase 4: Validation & Handoff
**Assume Role:** `@docs`
1. **Report**: Write the results to `docs/track/audits/self-evolution-<DATE>.md`.
2. **Handover**: Perform a `session-handover` to ensure the next AI assistant inherits the improved framework context.
3. **Sync**: Update `TODO.md` with any remaining "Framework Fixes".
