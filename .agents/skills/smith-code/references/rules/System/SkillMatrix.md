---
trigger: model_decision
description: Current skill-to-persona matrix for smith-code. Read after loading a persona to decide which local skills should support the task.
---

# Skill Matrix

Use only skills that exist in this build. Activate a skill when it materially improves the task; do not load design, browser, or framework skills just because they are available.

## Available Skills

`browser-use`, `codanna`, `critique`, `diagram-creator`, `fullstack-developer`, `huashu-design`, `impeccable`, `react`, `shadcn`, `skill-creator`, `smit-lint`, `smith-code`, `smth-doc`, `stitch-design-taste`, `tailwind-design-system`, `ui-ux-pro-max`

## Persona Bindings

| Persona | Best-fit skills | When to use |
| --- | --- | --- |
| `@pm` | `codanna`, `diagram-creator`, `critique`, `skill-creator` | Use `codanna` for impact discovery, `diagram-creator` for architecture/data-flow specs, `critique` to challenge risky plans, and `skill-creator` only when changing skills/rules/personas. |
| `@backend` | `smit-lint`, `codanna`, `fullstack-developer`, `critique` | Use `smit-lint` for Python/backend lint and fix passes, `codanna` before shared logic edits, `fullstack-developer` when backend work crosses into frontend contracts, and `critique` for risk review on complex logic. |
| `@api-specialist` | `smit-lint`, `codanna`, `fullstack-developer`, `critique` | Use `smit-lint` for contract-adjacent lint/type checks, `codanna` for call graph and schema impact, `fullstack-developer` for cross-boundary type sync, and `critique` for contract review. |
| `@frontend` | `smit-lint`, `react`, `shadcn`, `tailwind-design-system`, `codanna`, `browser-use`, `fullstack-developer` | Use `smit-lint` for JS/TS/React lint and fix passes, `react` for React/TSX work, `shadcn` when registry components are involved, `tailwind-design-system` for tokenized styling, `browser-use` for UI verification, and `fullstack-developer` when frontend depends on backend changes. |
| `@ui-designer` | `ui-ux-pro-max`, `stitch-design-taste`, `impeccable`, `huashu-design`, `tailwind-design-system`, `shadcn`, `browser-use` | Use `ui-ux-pro-max` for design-system choices, `stitch-design-taste` for `DESIGN.md`, `impeccable` for production-grade polish, `huashu-design` only when that visual language is requested, and `browser-use` for visual inspection. |
| `@docs` | `smth-doc`, `diagram-creator`, `codanna`, `critique`, `skill-creator` | Use `smth-doc` for docs sync from commits/changed files, `diagram-creator` for architecture visuals, `codanna` to verify documented code relationships, `critique` for docs review, and `skill-creator` when documenting or changing skill internals. |
| `@git` | `smit-lint`, `critique`, `codanna` | Use `smit-lint` for final lint gates, `critique` for final risk review, and `codanna` indexing after structural code changes. |

## Path Guidance

| Workflow path | Skill posture |
| --- | --- |
| `<lightweight_path>` | Prefer zero or one supporting skill. Keep context small. |
| Full SDLC | Load the persona's mandatory rules, then select supporting skills from this matrix. |
