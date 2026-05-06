# API Contract Standards

## Core Principles

- **Contract first:** Define request/response shape before implementation.
- **Typed boundary:** Backend Pydantic models and frontend TypeScript interfaces must stay equivalent.
- **Strict serialization:** Cross-boundary payloads must be JSON-safe. Convert `datetime`, `Decimal`, enums, and paths to strings or primitives.
- **Error truth:** Transport success must not hide business failure. Use explicit error payloads and status/error codes.
- **Backward compatibility:** Existing public method names and payload fields must not change without an explicit migration note.

## Workflow

1. Identify the existing endpoint, JSON-RPC method, route, or bridge function.
2. Read the current backend model and frontend consumer before editing either side.
3. Update the contract in the narrowest authoritative location.
4. Propagate type changes across backend, frontend, tests, and docs.
5. Verify serialization with the smallest available test or runtime check.

## Forbidden Patterns

- Returning raw Python objects that are not JSON-serializable.
- Updating frontend types without updating backend models, or the reverse.
- Returning `{ success: false }` through a path that callers treat as success.
- Adding untyped dictionaries where a model/interface should exist.
- Silently renaming fields used by existing callers.

