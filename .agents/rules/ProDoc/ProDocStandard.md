# ProDoc: The Living Knowledge Engine (v2)

## 1. Core Principles (Invariants)
*   **Living Graph:** Documentation must be treated as code. If it lies, it dies.
*   **Staleness Protocol:** If `git log` shows >50 changes since last `relations.md` update, Agent MUST regenerate it.
*   **No Read-All:** Agents must rely on `ProDoc` context, not full directory scans (Token efficiency).

## 2. Workflow (The Update Cycle)
1.  **Trigger:** Significant Refactor OR New Feature.
2.  **Audit:** Read `tech-stack.md` and `relations.md`.
3.  **Update:** 
    *   Add new Libraries to `tech-stack.md`.
    *   Add new Edges (Dependencies) to `relations.md`.
4.  **Verify:** Does the Graph match the Code?

## 3. Directory Structure (Strict)
*   **Root:** `ProDoc/`.
*   **Vision:** `ProDoc/documentation/product.md` (Why we are building).
*   **Graph:** `ProDoc/relations/relations.md` (How it works).
*   **Stack:** `ProDoc/tech-stack.md` (What we use).

## 4. Forbidden Patterns (Strict)
1.  **Ghost Docs:** Documenting features that were deleted.
2.  **Secret Knowledge:** "Everyone knows X" logic not written in `product-guidelines.md`.
3.  **Wiki Rot:** Using external Wikis (Confluence/Notion) for Architecture. It MUST be in Repo.

## 5. Golden Example (The Tech Stack)
```markdown
# Technology Stack
## Core
- **Language:** TypeScript 5.x
- **Framework:** Next.js 14 (App Router)
- **State:** Zustand

## Decisions
- **Why Zustand?** Redux is too verbose for this team size.
- **Why Tailwind?** Speed of iteration over semantic purity.
```
