# Diagram Standards

## Core Principles

- **Truth from code:** Diagrams must reflect verified files, imports, APIs, and runtime boundaries.
- **Labeled edges:** Every arrow must include the data, control, or dependency relationship.
- **Scoped view:** Choose one level of detail: context, container, component, sequence, or data model.
- **Readable first:** Prefer simple grouping and stable names over decorative detail.

## Workflow

1. Define the diagram question and audience.
2. Verify nodes and relationships with code search, Codanna, or docs.
3. Choose the smallest diagram type that answers the question.
4. Store durable diagrams in `docs/architecture/diagrams.md` or a task-specific spec.
5. Update diagrams in the same change that alters the architecture they describe.

## Forbidden Patterns

- Inventing services, calls, or dependencies.
- Connecting every node to every other node.
- Mixing sequence, deployment, and data-model views in one diagram.
- Leaving unlabeled arrows.
