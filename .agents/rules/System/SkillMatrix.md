---
trigger: model_decision
description: Skill-to-persona and SDLC support matrix for the current build.
---

# Skill Matrix

Use only skills that exist in this build. Activate a skill when it materially improves the task; do not load skills only because they are listed.

## Available Skills

`browser-use`, `codanna`, `critique`, `diagram-creator`, `fullstack-developer`, `huashu-design`, `impeccable`, `react`, `shadcn`, `skill-creator`, `smit-lint`, `smith-code`, `smith-doc`, `stitch-design-taste`, `tailwind-design-system`, `ui-ux-pro-max`

## Persona Bindings

| Persona | Best-fit skills | When to use |
| --- | --- | --- |
| Planning / PM | `smith-code`, `codanna`, `diagram-creator`, `critique`, `skill-creator` | Use for full SDLC planning, impact discovery, diagrams, plan critique, or skill/rule updates. |
| Backend / API | `smit-lint`, `codanna`, `fullstack-developer`, `critique` | Use `smit-lint` for Python/backend lint and fix passes, `codanna` for shared logic impact, `fullstack-developer` for cross-boundary work, and `critique` for complex risk review. |
| Frontend | `smit-lint`, `react`, `shadcn`, `tailwind-design-system`, `browser-use`, `fullstack-developer` | Use `smit-lint` for JS/TS/React lint and fix passes, `react` for React/TSX, `shadcn` for components, `tailwind-design-system` for tokens, `browser-use` for UI verification, and `fullstack-developer` for frontend/backend coupling. |
| UI Design | `ui-ux-pro-max`, `stitch-design-taste`, `impeccable`, `huashu-design`, `tailwind-design-system`, `shadcn`, `browser-use` | Use for design-system work, `DESIGN.md`, visual polish, requested Huashu style, token systems, components, and screenshots. |
| Documentation | `smith-doc`, `diagram-creator`, `codanna`, `critique`, `skill-creator` | Use `smith-doc` for docs sync from commits/changed files, `diagram-creator` for architecture visuals, `codanna` for verified code relationships, `critique` for docs review, and `skill-creator` for rule/skill documentation. |
| Release / Git | `smit-lint`, `critique`, `codanna` | Use `smit-lint` for final lint gates, `critique` for final risk review, and `codanna` for re-indexing after structural changes. |

## SDLC Phase Support

| Phase | Typical support |
| --- | --- |
| Boot | `bd ready`, handoff review, scope classification |
| Discovery | Codanna, `rg`, local docs, official docs when needed |
| Planning | `smith-code`, `diagram-creator`, bead spec |
| Implementation | Persona-specific skills from the matrix |
| Testing | `smit-lint`, focused project tests, browser verification where relevant |
| Documentation | `smith-doc`, docs-first outputs, marker update, and handoff |
| Close | Bead update, final verification summary, optional commit |
