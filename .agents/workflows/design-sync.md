---
description: Design System Sync - Propagate DESIGN.md changes to the codebase
---

// turbo-all
Triggered by `/design-sync <change_description>`. This workflow ensures that any modifications to the Design System are documented in `DESIGN.md` first and then surgically propagated to the CSS tokens and component layers.

## Workflow: [DesignSync]

### 1. [SPEC] - Update Source of Truth
- **Role**: `@pm`
- Locate the relevant tokens in `DESIGN.md` (colors, typography, rounded, spacing).
- Apply the requested changes to the YAML frontmatter and the documentation body of `DESIGN.md`.
- **Constraint**: Every design change MUST start here to maintain the "Identity Override" protocol.

### 2. [SYNC-CSS] - Token Propagation
- **Role**: `@frontend`
- Read the updated `DESIGN.md`.
- Synchronize `src/styles/globals.css` (the `@theme` block) with the new values.
- Ensure all Tailwind variables (`--color-*`, `--radius-*`, etc.) match the YAML tokens exactly.

### 3. [SYNC-UI] - Structural & Component Audit
- **Role**: `@frontend`
- If the change involves sizing (button height, radius, padding):
    - Audit atomic components in `src/components/atoms/` and `src/components/ui/`.
    - Verify if shadcn presets or `tailwind.config.js` need adjustments for the new scales.
- If the change is a color shift:
    - Verify that semantic mappings (Log Levels, Statuses) are still legible.
    - Check for contrast ratio compliance in high-density areas (Log Table).

### 4. [VERIFY] - Visual & Lint Check
- **Role**: `@qa`
- Run `/autolint` to ensure Biome standards are met.
- Confirm that the Vite dev server is running and HMR has applied the changes without errors.

### 5. [REFLECT] - Design Evolution
- **Role**: `@architect`
- Update `docs/track/LessonsLearned.md` if the design change uncovered new architectural constraints (e.g., "The new radius breaks the virtual list alignment").
- Verify that `DESIGN.md` remains the absolute source of truth for all future AI agents.
