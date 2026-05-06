---
trigger: always_on
description: Senior-level software engineering philosophy and language-specific standards.
---

# Global Engineering Philosophy (v0.11.0)

## 1. Core Mandates
- **DRY**: Logic duplication is forbidden. Abstract repeated logic into shared modules.
- **KISS**: Prioritize readability over complex optimizations.
- **YAGNI**: Implement only what is required by the active `bd` task.
- **Workflow Anchor Law**: If `sequentialthinking` is used to plan a task, the resulting plan MUST be immediately anchored in a `bead` via `bd create` or `bd update` BEFORE any other tool is called. Jumping from Planning (Thought) to Implementation (Code) without registration is a critical protocol failure.
- **S.O.L.I.D. Enforcement**:
  - **Single Responsibility**: Modules must have exactly one reason to change.
  - **Open/Closed**: Logic must be extendable without modification.
  - **Liskov Substitution**: Subtypes must be substitutable for their base types.
  - **Interface Segregation**: Prefer many specific interfaces over one general-purpose interface.
  - **Dependency Inversion**: Depend strictly on abstractions (Ports), never concretions (Adapters).

## 2. Implementation Mandates
- **Composition**: Favor object composition over inheritance hierarchies.
- **Fail Fast**: Validate state/inputs at entry. Throw descriptive errors immediately.
- **Statelessness**: Prioritize pure functions to ensure testability.
- **Immutability**: Favor immutable structures to eliminate race conditions.
- **Meaningful Names**: Variables, functions, and classes must have descriptive names that reveal intent. Avoid abbreviations.
- **Small Functions**: Functions must do one thing. If > 30 lines, break it down.
- **No Magic Numbers**: Use named constants or enums, never hardcoded literals.

## 3. Language Specializations

### 3.1 Python (uv / ruff)
- **Immutable Globals**: Use `tuple` or `frozenset` for constants.
- **Logging**: Use lazy evaluation (%) for logging templates, never f-strings.
- **Type Safety**: Mandatory type hints for all signatures using `collections.abc`.
- **Default Sentinel**: Use `None` as the sentinel; mutable defaults are forbidden.
- **Comprehensions**: Use list/set/dict comprehensions for concise collection building.
- **Iteration**: Use `enumerate()`, `zip()`, `dict.items()`. Avoid manual index tracking.
- **Built-ins**: Leverage `all()`, `any()`, `reversed()`, `sum()`.
- **Context Managers**: Always use `with` statements for resource management.
- **Error Handling**: Use bare `raise` to preserve stack traces. Chain with `raise X from e`.
- **Collections**: Use `Counter` for counting, `defaultdict` for initialization.
- **ASCII-Only Terminal Output**: All terminal decorations (boxes, arrows, dividers) MUST use ASCII-only characters to ensure cross-platform compatibility (prevents CP1252 encoding errors on Windows).
- **Ruff Pre-test Gate**: Proactively run `ruff check` before `pytest`. A single syntax/import error in a test file can block the entire collection process; Ruff catches these faster.
- **Async Test Support**: Standardize on `pytest-asyncio` in `auto` mode for all asynchronous Python logic.
- **Data Classes**: Use `pydantic` for API models, Python `dataclasses` for internal state.

### 3.2 JavaScript / TypeScript (bun / biome)
- **Global Scope**: Use `globalThis` instead of `window`.
- **Typing**: Strict types only. `any` is prohibited.
- **React**: Strictly use functional components and hooks. Class components are forbidden.
- **JSDoc**: Mandatory for all exported functions and components.

## 4. Documentation Standards
- **Why, not What**: Comments MUST explain the rationale, not restate the code.
- **Stale Comments**: Always update or delete comments when the code changes.
- **Commit Format**: Strictly follow [Conventional Commits](https://www.conventionalcommits.org/): `<type>(<scope>): <description>`. Types: `feat`, `fix`, `refactor`, `docs`, `test`, `chore`.

## 5. Ruthless Pruning
- **Delete, Don't Comment**: Rely on Git for history. Do not leave commented-out code.
- **Immediate Cleanup**: Delete original files immediately after a move or rename.
- **Import Hygiene**: Strip unused imports in every turn. Empty files must be deleted.
