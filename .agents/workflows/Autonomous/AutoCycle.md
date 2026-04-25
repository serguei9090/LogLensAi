---
trigger: model_decision
description: High-performance autonomous development loop using specialized personas.
---

# 🚀 AutoCycle: Autonomous Development Loop
> **Assume Role:** `@brain` (Lead Architect)

Triggered by `/autocycle <mission>`. This workflow orchestrates a complete Software Development Life Cycle (SDLC) autonomously, moving from specification to deployment.

## 🔄 The Cycle

### 1. 📋 Specification & Roadmap (@brain)
- **Role**: `Lead Architect (@brain)`
- **Goal**: Define the "What" and "Why".
- **Tasks**:
  - Scan the codebase to understand the current implementation.
  - Create a technical specification in `docs/track/specs/PLAN-[TASK_ID].md`.
  - Update `docs/track/TODO.md` with prioritized tasks.
- **Verification**: Ensure the plan aligns with user intent and project constraints.

### 2. 🏗️ Architecture & Contracts (@brain)
- **Role**: `Lead Architect (@brain)`
- **Goal**: Define the "How" and ensure structural integrity.
- **Tasks**:
  - Review the spec against `.agents/rules/System/Architecture.md`.
  - Define or update API contracts in `docs/Documentation/reference/API_SPEC.md`.
  - Ensure **Ports & Adapters** compliance.
- **Verification**: `diagram-creator` skill must be used to visualize any structural changes.

### 3. 💻 Implementation (@api-specialist | @ui-designer | @theme-expert)
- **Role**: `Implementation Squad`
- **Goal**: Execute surgical code changes.
- **Tasks**:
  - **API Specialist (@api-specialist)**: Define and enforce the RPC boundaries and data contracts (Backend Logic).
  - **UI Designer (@ui-designer)**: Focuses on UX/UI, accessibility, and high-fidelity component design (Frontend Logic).
  - **Theme Expert (@theme-expert)**: Standardize CSS vars, design tokens, and maintain color harmony.
  - Adhere to `.agents/rules/System/SoftwareStandards.md` and `CodeQuality.md`.
- **Verification**: Run `grep_search` to ensure no regression in related modules.

### 4. 🛡️ Quality Assurance (@qa)
- **Role**: `QA Engineer (@qa)`
- **Goal**: Zero-defect delivery.
- **Tasks**:
  - **Lint**: Run `bun x biome check --write` and `uv run ruff check --fix`.
  - **Test**: Run `bun test` and `uv run pytest`.
  - **Audit**: Use `audit` skill for accessibility and performance.
- **Verification**: All exit codes must be `0`.

### 5. ✍️ Documentation & Handoff (@doc-agent)
- **Role**: `Documentarian (@doc-agent)`
- **Goal**: Preserve knowledge and clean up.
- **Tasks**:
  - Update `docs/track/LessonsLearned.md` with technical insights.
  - Summarize changes in `docs/WikiFlow/handoff_resume.md`.
  - Close completed tasks in `docs/track/TODO.md`.
- **Final Report**: Output a professional summary of the mission results.

---

// turbo
**Command to start cycle**: `gemini -y -p "Execute /autocycle for <mission>"`
