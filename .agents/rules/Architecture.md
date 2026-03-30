---
trigger: always_on
description: Foundational architecture boundaries to ensure robust component decoupling.
---

# Architecture Standards

To maintain a clean codebase and avoid tight coupling, all code must adhere to the following global principles. These principles ensure that business logic remains completely separate from infrastructure or side-effects (like UI, databases, or networking).

## 1. Separation of Concerns (SoC)
Ensure that modules are highly cohesive and loosely coupled. Business logic should not be aware of infrastructure details (e.g., database clients, HTTP frameworks). The entry point should act merely as a traffic controller, orchestrating dependencies and routing data between the domain layer and infrastructure layer.

## 2. Interface-First Design
Define abstractions (Interfaces, Traits, or Protocols) before writing concrete logic. Code against these abstractions, not specific implementations. This ensures that you can swap out infrastructure without modifying domain logic.

## 3. Dependency Injection (DI)
Inject components (like loggers, database repositories, and metrics recorders) into functions and classes. Avoid hardcoding infrastructure connections or instantiations deep within domain logic files.

## 4. Spec-Driven Development Workflow
Follow this "Definition Path" before writing code:
1. **Define the Contract**: Specify the communication contract (e.g., OpenAPI spec, Protobuf definition, or explicit data types).
2. **Define the Interface**: Write the abstract interface representing the input/output boundaries.
3. **The "Mock" Test**: Write tests against mock implementations of the interface to validate the contract.
4. **The Implementation**: Write the actual concrete logic connecting to the real systems.

## 5. Testing Philosophy (ADK Standard)
- **Use real code over mocks**: Tests MUST use real implementations as much as possible. Only mock external dependencies (network, cloud services).
- **Test interface behavior, not implementation details**: Verify the public API behaves correctly, not *how* it's internally implemented. This ensures resilience to refactoring.
- **Isolation & Speed**: Tests should be fast and isolated. Use `tmp_path` for isolated filesystem tests.
- **Coverage**: Ensure high coverage for new features, edge cases, and error conditions.

## 6. Ports and Adapters (Hexagonal Architecture)
- **Port**: Defines what needs to be done. These are interfaces inside the Domain layer.
- **Adapter**: Defines how it is implemented. These are concrete classes or functions inside the Infrastructure layer.
- **Usage**: The domain calls a Port, and the dependency injection framework provides the Adapter.

## 7. SQL Aliasing & Binder Safety
- **Single Point of Aliasing**: In SQL queries using table aliases (e.g., `logs l`), NEVER manually alias fields in the raw clause builder (`where_clauses.append("l.id = ?")`). Instead, use clean field names and apply the alias globally using a single string replacement pass (e.g., `aliased_sql = raw_sql.replace("timestamp", "l.timestamp")`).
- **Binder Parity**: Every query in a single execution flow (e.g., `count_query` and `data_query`) MUST use the exact same aliasing and filtering logic to ensure `total` and `results` are logically synchronized.

## 8. Single Source of Truth (Type-Sync)
- **Contract Definition**: All communication models must be defined by the absolute backend source of truth (e.g. strict classes, schemas).
- **Type Generation**: Always generate consumer types (like Typescript interfaces) directly from the backend source code. 
- **Mirror Policy**: Never manually edit frontend types for backend responses; subagents must re-run the generator if schema changes.

## 9. Deterministic Validation
- **Environment Isolation**: The validation loop (TDD) should run inside a hermetic environment like a `Dockerfile` to ensure parity between the `@jules-agent` environment and production.

## 10. Breaking Changes & Versioning
LogLensAi adheres to **Semantic Versioning 2.0.0** (MAJOR.MINOR.PATCH).

### Breaking Change Checklist
A MAJOR version bump is required for:
- **API Signature Change**: Renaming, removing, or altering required parameters of public classes/methods.
- **Data Schema Change**: Non-additive changes to persisted data (DuckDB schema, session format).
- **Wire Format Change**: Modifying JSON-RPC request/response structures (e.g., snake_case to camelCase).
- **CLI/Contract Shift**: Altering command-line arguments or fundamental communication protocols.
- **Architectural Shift**: Core behavior changes that force consumers to alter existing code (e.g., making methods async).
