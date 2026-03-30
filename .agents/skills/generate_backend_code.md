# Skill: Generate Backend Code

## Objective
Your goal as the Backend Engineer is to build the robust server-side engine and infrastructure in the `sidecar/src/` directory.

## Rules of Engagement
- **Dynamic Coding**: You are working on the Python 3.12+ Sidecar engine.
- **Save Location**: Save all your raw code in `sidecar/src/`.
- **Code Standards**: 
  - Mandatory Python Google-style docstrings for all public functions/classes.
  - Mandatory "// TODO(ID)" protocol for any incomplete or deferred logic.
  - Every non-obvious block must have a "why" comment.
  - Use `self.db.get_cursor()` for all DuckDB queries.

## Instructions
1. **Read the Contracts**: Open and carefully study `docs/track/Technical_Specification.md` and `docs/API_SPEC.md`.
2. **Scaffold/Update Backend**: Generate or modify application logic in `sidecar/src/` (api.py, db.py, etc.).
3. **Internal Documentation**: Ensure all classes and functions include a purpose description and parameter types.
4. **Validation Logic**: Implement strict input validation using `Pydantic` models where applicable.
5. **Output**: Dump your backend code perfectly into the `sidecar/src/` directory. Do not skip or summarize any code blocks.
