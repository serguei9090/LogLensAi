---
trigger: always_on
description: Mandatory standards for code commenting and TODO management.
---

# AI-Driven Commenting & TODO Standards

To ensure maximum clarity and maintainability, all code must adhere to the following commenting and tracking standards.

## 1. General Commenting Rules
- **Functions**: Every function must have a doc-comment describing:
  - **Purpose**: What the function does.
  - **Callers**: Who is responsible for calling this function.
  - **Parameters/Return**: Brief explanation of inputs and outputs.
- **Variables/Fields**: Every non-trivial variable or field must have a comment explaining its role in the system.

## 2. Placeholder & Incomplete Code (TODOs)
Any code created as a placeholder or requiring future implementation MUST use the `TODO` keyword followed by a unique ID.

### TODO Format
```
// TODO(unique_id_001): Description of exactly what is missing or needs implementation.
```

### Protocol for New TODOs
When a `TODO` is introduced:
1. **Assign a Unique ID**: Use a descriptive prefix and a sequential number (e.g., `feature_name_001`).
2. **Create Detail File**: Create a markdown file in `docs/TODOC/<unique_id>.md`.
3. **Update Roadmap**: Add the task to the project's `docs/track/TODO.md`.

## 3. Completing TODOs
When the logic for a `TODO` is implemented:
1. **Replace Comment**: Remove the `TODO(...)` comment and replace it with a proper standard doc-comment as defined in Section 1.
2. **Mark as Done**: Update the status in `docs/track/TODO.md`.
3. **Archive/Update Detail**: The detail file in `docs/TODOC/` should be updated to reflect the implementation details or archived if no longer relevant.
