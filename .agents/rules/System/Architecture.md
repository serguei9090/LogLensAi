---
trigger: always_on
description: Foundational architecture boundaries and system integrity guardrails.
---

# Architecture Standards (v0.11.0)

## 1. MANDATORY: The Bridge Protocol (Law #1)
- **Universal Constraint**: All React-to-Sidecar communication MUST use the `callSidecar` bridge.
- **Forbidden**: Direct `invoke` calls are strictly prohibited.
- **Error Handling**: All calls must be wrapped in the standardized bridge error boundary.
- **Contract Integrity**: Every JSON-RPC method in `api.py` MUST have a corresponding `BaseModel` request class.
- **Serialization**: Sidecar methods MUST return stringified timestamps; native `datetime` objects are forbidden.

## 2. Ports and Adapters (Hexagonal Law)
- **Separation**: Business logic MUST NOT be aware of infrastructure (DB clients, HTTP frameworks).
- **Port**: Define communication interfaces in the Domain layer first.
- **Adapter**: Implement concrete logic (Infrastructure) only after the Port is defined.

## 3. Persistence & Data Safety
- **DuckDB Concurrency**: Use `self.db.get_cursor()` within every sidecar method. Do NOT share cursors across async boundaries.
- **Source of Truth**: Backend Pydantic models are the authoritative schema. Frontend types MUST be generated from these models.
- **Query Parity**: All multi-query execution flows (e.g., `count` + `data`) MUST use identical aliasing and filter logic.

## 4. UI Structure & Lifecycle
- **Hydration Safety**: No nested interactive elements. Use `role="button"` for custom containers.
- **Provider Parity**: Explicitly re-initialize backend providers (e.g., AI models) immediately upon settings changes.

## 5. Versioning
- **SemVer**: Strictly follow Semantic Versioning 2.0.0.
- **Breaking Changes**: Any API signature or data schema shift REQUIRES a major version bump.
