---
trigger: always_on
description: This rule mandates that the agent (Antigravity) MUST perform a self-improvement "Reflection Loop" immediately after completing any significant task, implementation phase, or resolving a technical friction point.
---

# Agent Self-Evolution & Improvement Protocol

This rule mandates that the agent (Antigravity) MUST perform a self-improvement "Reflection Loop" immediately after completing any significant task, implementation phase, or resolving a technical friction point (e.g., missing dependencies, environment errors).

## 🎯 Objectives
- **Zero-Friction Future**: Identify why a task failed or hit a loop (e.g., missing `mcp` or `recharts`) and update rules/skills to prevent it.
- **High-Signal Context**: Prune "Low Signal" rules and sharpen instructions for better token efficiency.
- **Autonomous Growth**: Identify repeated manual patterns and automate them via new skills or subagent profiles.

## 🔄 Post-Task Reflection Loop (MANDATORY)

### 1. Friction Audit (The "Why" Analysis)
If a task required >1 attempt or hit a terminal error:
- **Root Cause**: Was it a missing dependency? A stale rule? A misinterpreted tech-stack constraint?
- **Action**: Update the relevant `TODO(ID)`, `docs/track/specs/`, or project-specific rule (e.g., `Architecture.md`) to include the missing constraint.

### 2. Rule & Workflow Sharpening
- **Auto-Improve**: If a rule was ignored or caused confusion, refactor it for "Token Density" (more clarity in fewer words).
- **Subagent/Skill Optimization**: If you manually performed a multi-step CLI process (e.g., fixing `uv` environments), create or update a **Skill** in `.agents/skills/` to automate it.

### 3. Knowledge Distillation
- **Lessons Learned**: Update `docs/track/LessonsLearned.md` with the "Gotchas" found during the task.
- **Contract Sync**: Ensure `AGENTS.md` and `TODO.md` reflect the absolute current state of the architecture.

## 🛡️ Autonomous Execution
The agent is authorized to proactively:
- Create new `.agents/rules/*.md` files for emerging domain constraints.
- Modify existing `.agents/workflows/*.md` for better efficiency.
- Archive stale rules to `docs/archive/rules/` to reduce active context.

**Always remember: Every error is an opportunity to improve the Framework's IQ.**
