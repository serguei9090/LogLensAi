# Hybrid Memory Architecture

This directory serves as the **Long-Form Hard Drive** for the AI Agent Ecosystem, operating in tandem with **Beads (bd)**.

## The Hybrid Division of Labor

### 1. Beads (`bd`) - The Index & Short-Term RAM
Beads is the single source of truth for:
*   **Tasks & Roadmap:** (Replacing `TODO.md`)
*   **Atomic Facts:** E.g., `bd remember "RULE: Always use globalThis"`
*   **Pointers:** Beads acts as the search index pointing to the heavy files in this directory.

### 2. `docs/memory/` - The Long-Form Hard Drive
This folder is used for data that is too heavy, complex, or formatted to fit efficiently in a terminal/database string:
*   **`/architecture/`**: System maps, Mermaid.js diagrams, and C4 charts.
*   **`/specs/`**: Deep technical specifications, API payload definitions, and Database schemas.
*   **`/lessons/`**: Detailed post-mortems of complex bugs or architectural pivots.

## Workflow Example
If you write a 200-line Markdown specification for a new Auth system in `docs/memory/specs/auth_v2.md`, you **MUST** index it in Beads:
`bd remember "ARCHITECTURE [Auth]: The full V2 authentication specification and API payload schemas are located in docs/memory/specs/auth_v2.md"`

*This ensures the AI gets the instant speed of a database query while retaining the rich formatting of a Markdown file.*
