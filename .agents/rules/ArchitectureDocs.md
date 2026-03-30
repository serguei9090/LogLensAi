---
trigger: model_decision
description: Mandatory rule to update architecture documentation whenever a new function, feature, or file is created.
---

# Architecture Documentation Protocol (STRICT)

To maintain a "Single Source of Truth" and avoid repetitive search commands, all core architectural elements MUST be documented in `docs/architecture/`.

## 1. The "Document-on-Change" Law
Any task that results in the creation/modification of the following items MUST include a corresponding update to the architecture documentation as part of the same PR/commit:
- **New File**: Add to the relevant file in `docs/architecture/layers/` and index in `gemini.md`.
- **New function/method**: Document purpose, inputs, and outputs in the layer-specific architecture file.
- **New State/Variable**: Document in the store section (frontend) or configuration section (backend).
- **New Feature/Flow**: Update the system diagram in `docs/architecture/diagrams.md` or `gemini.md`.

## 2. Directory Structure (`docs/architecture/`)
- **`gemini.md`**: Main entry point. Contains "Personas" and the high-level C4-style System Context diagram.
- **`layers/frontend.md`**: Detailed breakdown of React atoms, molecules, organisms, templates, and pages. Includes Zustand store schemas.
- **`layers/backend.md`**: Detailed breakdown of sidecar modules, JSON-RPC method implementations, and DuckDB schema definitions.
- **`communication.md`**: Detailed JSON-RPC 2.0 protocol specifications and bridging logic.
- **`diagrams.md`**: Collection of modular Mermaid.js diagrams (ERD, Sequence, Flow).

## 3. Reference Protocol
Before performing any structural change or searching for existing logic:
1. **Consult `docs/architecture/gemini.md`**: Use it to find where a logic block *should* live.
2. **Follow the Personas**: Use the layer-specific files to understand the "soul" of each module before writing code.
3. **Check for Gaps**: If the architecture docs are missing a detail found during `grep_search`, your FIRST priority is to update the doc before completing the feature.

## 4. Mermaid Standard
- All diagrams MUST use Mermaid.js syntax.
- Diagrams MUST be kept in sync with the actual file structure.
- Use `diagram-creator` skill to maintain visual architecture.
