---
trigger: always_on
description: Senior-level software engineering standards and best practices.
---

# Global Software Engineering Standards (The Golden Rules)

To ensure high-quality, maintainable, and scalable software, all code must strictly adhere to these industry-standard best practices.

## 1. Core Principles
- **DRY (Don't Repeat Yourself)**: Avoid logic duplication. If you find the same logic in two places, abstract it into a reusable function, component, or module.
- **KISS (Keep It Simple, Stupid)**: Prefer simple, readable solutions over "clever" or overly complex ones. Code is read more often than it is written.
- **YAGNI (You Ain't Gonna Need It)**: Do not implement functionality until it is actually needed. Avoid speculative "just-in-case" engineering.
- **S.O.L.I.D. Principles**:
  - **Single Responsibility**: A class or module should have one, and only one, reason to change.
  - **Open/Closed**: Software entities should be open for extension but closed for modification.
  - **Liskov Substitution**: Subtypes must be substitutable for their base types.
  - **Interface Segregation**: Prefer many client-specific interfaces over one general-purpose interface.
  - **Dependency Inversion**: Depend on abstractions, not concretions.

## 2. Implementation Standards
- **Composition over Inheritance**: Prefer building complex functionality by combining simple objects rather than using deep inheritance hierarchies.
- **Fail Fast**: Validate inputs and state early. Throw descriptive errors as soon as an invalid state is detected.
- **Pure Functions**: Where possible, write functions that have no side effects and return the same output for the same input. This makes testing and reasoning significantly easier.
- **Immutability**: Favor immutable data structures. Avoid shared mutable state to prevent race conditions and unpredictable side effects.

## 3. Clean Code Practices
- **Meaningful Names**: Variables, functions, and classes must have descriptive names that reveal intent. Avoid abbreviations.
- **Small Functions**: Functions should do one thing and do it well. If a function is longer than 20-30 lines, consider breaking it down.
- **No Magic Numbers**: Use named constants or enums instead of hardcoded literal values.

## 4. Documentation & Comments
- **Code should be self-documenting**: Comments should explain *why* something is done, not *what* is being done (the code should tell you *what*).
- **Rationale-First**: Use comments to explain complex algorithms, non-obvious business logic, or the rationale behind a particular implementation choice.
- **Stale Comments are Dangerous**: Always update comments when the code they describe changes. If a comment is no longer accurate, delete it or fix it.

## 5. Commit Message Format (Required)
All commits MUST follow [Conventional Commits](https://www.conventionalcommits.org/en/v1.0.0/) format.
- **Format**: `<type>(<scope>): <description>`
- **Types**: `feat`, `fix`, `refactor`, `docs`, `test`, `chore`.
- **Example**: `feat(log-parser): Add support for multi-line JSON logs`.

## 6. Python Specialized Standards
- **Constants**: Use immutable global collections (`tuple`, `frozenset`, `immutabledict`). Avoid magic strings/numbers.
- **Naming**: Use descriptive mapping names like `value_by_key` (e.g., `item_by_id`).
- **Readability**: 
  - Use **f-strings** for concise formatting.
  - Use **lazy-evaluated % templates** for logging.
  - Use `_` as a numeric separator (`1_000_000`).
- **Comprehensions**: Use list/set/dict comprehensions for concise collection building.
- **Iteration**: Use `enumerate()`, `zip()`, and `dict.items()`. Avoid manual index tracking.
- **Built-ins**: Leverage `all()`, `any()`, `reversed()`, `sum()`.
- **Type Hinting**: Mandatory for all signatures. Use `Sequence`, `Mapping`, `Iterable` from `collections.abc`.
- **Argument Safety**: Use `*` to force keyword-only arguments for functions with multiple parameters of the same type.
- **Decorators**: Use `functools.wraps()` to preserve metadata.
- **Context Managers**: Always use `with` statements for resource management.
- **No Mutable Defaults**: NEVER use lists or dicts as default arguments. Use `None` as a sentinel.

## 7. Error Handling Standards
- **Re-raising**: Use a bare `raise` to preserve the stack trace. Use `raise NewException from original_exception` for chaining.
- **Messages**: Always include descriptive messages in exceptions.
- **Strings**: Use `repr(e)` or `traceback.format_exc()` for informative error logging.
- **Consistency**: If a function can return a value, ensure all paths return explicitly (e.g., `return None`).

## 8. Recommended Libraries & Tools
- **Collections**: Use `Counter` for counting and `defaultdict` for list-initialization.
- **Data Classes**: Use `pydantic` for API models and `Python dataclasses` for internal state objects.
- **Efficiency**: Use `heapq` for top/bottom-N items and `itertools` for advanced iteration.
- **Regex**: Use `re.VERBOSE` for complex expressions.

## 9. Project Specific Tooling Standards
### 7.1 System Tiers
*(Initialize project-specific constraints here before passing to Subagents. e.g. React/Vite, Python/DuckDB, Rust/Tauri.)*
- **Frontend Stack**: Provide constraints for rendering and state.
- **Backend Stack**: Provide constraints for persistence and logic.
- **Linting**: Enforce strict formatters across the repo.

## 8. Ruthless Pruning (The Anti-Dead-Code Law)
When an AI subagent refactors logic or alters a component path, it is **strictly forbidden** to leave the old logic commented out or abandon the old file.
- **Rule 1: Delete, Don't Comment**: Rely on Git history. Do not leave `// old implementation` blocks.
- **Rule 2: Severed Paths**: If a component is moved or renamed, the original file MUST be deleted immediately in the same step.
- **Rule 3: Unused Imports**: The agent must ensure unused imports are stripped during the Autofix Loop. If a file becomes empty, delete the file.
- **Rule 4: Structural Integrity Check**: After any multi-line `replace_file_content` or `multi_replace_file_content`, the agent MUST verify that class/function headers (e.g., `class App:`, `def handler():`) haven't been deleted or misaligned.

## 7. Visual Language & Mapping 
- Maintain consistent visual severity mappings across UI (e.g. strict hex colors for Info vs Error boundaries in logs/toasts).

## 8. LogLensAi Core Guardrails (@jules mandated)
- **RPC Contract Integrity**: Every JSON-RPC method added to `api.py` MUST have a corresponding `BaseModel` request class defined and **explicitly imported** in `api.py`. Failing this triggers a fatal `NameError`.
- **Atomic Reference Integrity**: When injecting new Store, Hook, or Utility logic into a component/module, the agent MUST immediately verify that the target file has the correct import statement.
- **Mandatory Health Verification**: After any significant edit to `src/` (Frontend) or `sidecar/` (Backend), the agent MUST run the following checks before finishing the turn:
  - **Backend**: `uv run ruff check sidecar/src/api.py`
  - **Frontend**: `bunx biome check src/components/...`
- **UI State Verification**: When styling stateful components (Switch, Checkbox, Tabs), verify the `data-` attributes in the underlying `ui/` component implementation. (e.g., Base-UI uses `data-[checked]` not Radix's `data-[state=checked]`).
- **Bridge Protocol**: All React-to-Sidecar communication MUST use the `callSidecar` bridge. Direct `invoke` calls to the sidecar are strictly forbidden to ensure consistent error handling and dev/prod parity.
- **DuckDB Thread Safety**: Always use `self.db.get_cursor()` within sidecar methods. Sharing cursors across async calls will cause database corruption.
- **Serialization Safety**: JSON-RPC methods in the sidecar MUST NEVER return native Python `datetime` objects. All timestamps and dates must be explicitly stringified (e.g., `str(dt)`) before returning to the `aiohttp` handler to prevent JSON serialization `TypeErrors`.
- **Hydration & DOM Nesting**: Interactive elements (Buttons, Anchors, etc.) MUST NEVER be nested within each other. In lists or sidebars, use `div` with `role="button"` and `tabIndex` for the outer container to permit inner interactive buttons without violating React hydration rules.
- **Provider Lifecycle Parity**: When updating settings that affect backend state (e.g., `ai_model`, `ai_provider`), the `App` constructor or update handler MUST explicitly re-initialize the corresponding provider to reflect the new user preference immediately.
