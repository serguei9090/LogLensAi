---
trigger: always_on
description: Mandatory standards for code quality, commenting, TODO management, and UI design.
---

# Code Quality & Documentation Standards

To ensure maximum clarity, maintainability, and consistent UI, all code must adhere to the following standards.

## 1. Zero-Guesswork Commenting Standard 
To maintain context for subagents across sessions, code must be thoroughly self-documenting.

- **Philosophy**: Well-written code should be largely self-documenting. Comments should explain complex algorithms, non-obvious business logic, or the rationale behind a particular implementation choice—the things the code cannot express on its own. **Explain the Why, Not the What.** Avoid comments that merely restate what the code does.
- **Style**: Comments should be written as complete sentences. Block comments must begin with a `#` followed by a single space.
- **Functions/Classes (The Contract)**: 
  - **JS/TS**: Every exported function, interface, or class MUST have a full `JSDoc` block (`/** ... */`).
  - **Python**: Every public function or class MUST have a full `Google-style Docstring` (`""" ... """`). Implement `__repr__` for developer-focused representation and `__str__` for user-focused output.
  - Both must explicitly define: **Purpose** (What it does), **Args** (Inputs with types), **Returns** (Outputs), and **Raises/Throws** (Expected errors).
- **Variables/State**: Any non-obvious variable or React state declaration must have a 1-line inline comment explaining *why* it exists (e.g., `// Tracks user selection to prevent race condition during re-render`).
- **Complex Logic**: If a block of logic is highly algorithmic (like a DuckDB query or a Drain3 cluster evaluation), write a multi-line comment above it mapping out the steps in plain English before the code begins.

## 2. TODO(ID) Protocol (The "Task Memory")
Any incomplete interface, bypassed error, or missing feature MUST NOT be left as a silent placeholder. It MUST use the `TODO` keyword accompanied by a unique identifier.

- **The Formal TODO Syntax**: 
  - `// TODO(sync_001): [WHAT] Need to add debounce to this input. [WHY] API rate limits are being hit during fast typing.`
- **Creation Protocol (The "Detail File")**:
  1. **Assign a Unique ID**: (e.g., `api_gateway_001`).
  2. **Create the Brain**: Create a markdown file in `docs/TODOC/<unique_id>.md`. This is the **Active Task Memory**—include architectural choices, chosen libraries, logic snippets, and why we made those decisions.
  3. **Index the Task**: Add the high-level task to `docs/track/TODO.md`, linking to the detail file.

## 3. Pure TDD & Architectural BDD (Hybrid)
We distinguish between **Architectural Guidance** and **Implementation Speed**:
- **BDD (Gherkin)**: Use `.feature` files ONLY for high-level architectural contracts and user flows. This provides the "Living Spec" that mirrors your requirements.
- **Pure TDD (Vitest/Pytest)**: During the intense implementation phase, we skip the Gherkin layer for specific unit logic. AI is faster with pure code definitions than English abstraction parsing.
- **The Flow**: Define Interface -> (Optional) Write Gherkin Feature for high-level flow -> Write isolated failing TDD spec -> Invoke `@jules-agent` -> Pass.


## 3. Atomic Design (Frontend/UI)
For any frontend components, the modular hierarchy must be strictly enforced:
- **Atoms**: Smallest functional units (e.g., buttons, inputs, icons).
- **Molecules**: Groups of atoms functioning together (e.g., search bar, form field).
- **Organisms**: Complex UI sections (e.g., header, navigation, sidebar).
- **Templates**: Page-level layouts focusing on content structure without real data.
- **Pages**: Specific instances of templates populated with real data and state.
