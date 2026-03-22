# Master AI Context: Morphic AI Engineering Framework

Welcome to the Morphic AI Engineering Framework. This workspace is governed by high-performance software engineering laws.

## 🗺️ Rule-Map (The Laws of Physics)
- **Architecture**: `.agents/rules/Architecture.md` (Hexagonal + Ports/Adapters)
- **Tracking/Boot**: `.agents/rules/ProjectTracking.md` (Session Sync + Boot Sequence)
- **Software Standards**: `.agents/rules/SoftwareStandards.md` (DRY, KISS, SOLID)
- **Quality/TODO**: `.agents/rules/Quality.md` (TODO(ID) + Atomic Design)
- **AI Expert Practices**: `.agents/rules/AI_Expert_Practices.md` (Mnemonic Anchors + Verification)
- **Visual Law**: `.agents/rules/VisualArchitecture.md` (AVAS Visualization)

## Core Mandates

1. **Spec-Driven Development**: Always define contracts and interfaces before writing implementations. Follow the Ports & Adapters (Hexagonal) architecture to ensure Separation of Concerns.
2. **Dual-Roadmap Parity**: Ensure that your internal task execution perfectly aligns with the project's human-facing `docs/track/TODO.md`. Keep statuses continuously synced.
3. **Software Excellence**: Strictly adhere to **DRY, KISS, YAGNI, and SOLID** principles. Favor composition over inheritance and pure functions where possible.
4. **TODO(ID) Protocol**: Track every piece of technical debt or missing implementation with a uniquely identified TODO and a dedicated detail file in `docs/TODOC/`.
5. **UI Atomic Design**: Structure frontend components strictly by Atoms, Molecules, Organisms, Templates, and Pages.
6. **Visual Architecture Law**: All architectural representations MUST follow the **AVAS** (Agentic Visual Architecture Standard).
   - **Passive Law**: Diagrams must always use subgraphs and labeled connections.
   - **Active Capability**: For diagram generation, use the `diagram-creator` skill.

## AI Assistant Ecosystem
You are supported by a suite of specialized sub-agents:
- **`@doc-agent`**: Automates documentation updates based on code changes.
- **`@diagram-agent`**: Expert architect sub-agent for generating AVAS-compliant visual maps.
- **`@lint-agent`**: Enforces code style and documentation consistency.
- **`@reviewer-agent`**: Performs deep architectural audits and code reviews.

## Core Meta-Skills
You are equipped to evolve your own capabilities:
- **`rule-creator`**: Create and maintain high-signal architectural and operational rules.
- **`skill-creator`**: Build modular capabilities, workflows, and automated scripts.
- **`diagram-creator`**: Generate multi-level (C4-style) architectural maps.
- **`code-gap-reviewer`**: Perform specialized audits and architectural drift analysis.
- **`session-handover`**: Perform a "Session Wrap-up" to ensure context continuity.

## Initialization & Operational Logic
- **Context Injection**: Before starting a task, read `docs/track/TODO.md` to ensure your internal state matches the workspace.
- **Rules Persistence**: Every request you handle must be evaluated against the files in `.agents/rules/`.
- **Codetographer Mode**: When asked to "map" or "visualize," activate `diagram-creator` or delegate to `@diagram-agent`.

## Golden Standards
- **Contract -> Interface -> Mock -> Impl**: Never write logic without defining the boundary first.
- **Abstractions over Concretes**: Never hardcode infrastructure inside domain files.
- **100% Transparency**: Never leave silent placeholders. If it's missing, it gets a `TODO(ID)`.
