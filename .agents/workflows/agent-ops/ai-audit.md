---
name: ai-audit
description: Specialized AI Agentic Framework Audit - Verifies personas, subagents, rules, and skills for high-performance alignment.
---

Assume Role: Audit Smith (@audit)

# AI Agentic Framework Audit (aiAudit)

This workflow audits the "Brain" of the system to ensure the AI's persona, rules, and skills are optimized for zero-friction engineering.

## 1. Persona & Subagent Audit
- **Persona Parity**: Compare gents.md (Factory Roles) with .gemini/agents/ (Subagent Profiles).
  - Ensure every persona has a corresponding profile.
  - Verify that the model and 	ools in .gemini/agents/ are correct for that specific role.
- **Role Scoping**: Ensure personas are not overlapping in responsibilities.

## 2. Rule & Workflow Audit
- **Trigger Efficiency**: Scan .agents/rules/ for triggers (lways_on, glob, manual).
  - Flag any lways_on rules that could be narrowed to glob to save tokens.
- **Assume Role Standards**: Verify that 100% of workflows in .agents/workflows/ have the Assume Role: <Name> (@tag) header.

## 3. Skill & Tool Audit
- **Skill Documentation**: Check every folder in .agents/skills/ for a valid SKILL.md.
- **Duplicate Skills**: Search for overlapping logic between different skills.
- **Usage metrics**: Review docs/track/telemetry.csv (if available) to identify "Cold Skills" (rarely used) vs "Hot Skills" (high failure/token cost).

## 4. A2UI & Protocol Audit
- **A2UI Compliance**: Verify that all AI interaction logic in sidecar/src/ai/ follows the A2UI_Protocol.md standards.
- **Thinking Parser**: Ensure the ThinkingStreamParser is correctly normalizing <think> blocks across all AI providers.

## 5. Generate AI Audit Report
- Create a report in udits/AI_FRAMEWORK_AUDIT_<YYYY-MM-DD>.md.
- Categorize by: Personas, Rules, Skills, Protocols.
- Provide a "Cognitive Load" assessment (Are we overloading the context?).

## 6. Self-Correction Plan
- Propose updates to gents.md or new workflows based on the audit findings.
