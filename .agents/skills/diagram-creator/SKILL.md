---
name: diagram-creator
description: Expert architect skill for generating C4-compliant Mermaid.js diagrams. Use this when asked to "visualize," "map," or "diagram" any part of the system architecture or data flow.
---

# Diagram Creator Skill (AVAS)

This skill implements the **Agentic Visual Architecture Standard (AVAS)** to transform complex codebases into intuitive visual patterns.

## 1. The Visualization Stack (C4 Selection)
When triggered, select the appropriate zoom level:
- **Level 1 (Context)**: System boundaries and external dependencies.
- **Level 2 (Container)**: Tech stack, deployable units, and network protocols.
- **Level 3 (Component)**: Internal logic, module relationships, and data schemas (ERDs).

## 2. Diagram Generation Mandates
- **Top-Down Flow**: Always use `graph TD`.
- **Logical Grouping**: Use `subgraph` for clusters (e.g., `Client_Side`, `Backend_Service`, `Persistence`).
- **Explicit Labeling**: Every arrow `-->` MUST have text: `A -->|Protocol/Action| B`.
- **Standardized Shapes**:
  - `[(Database)]` (Cylinder)
  - `{{External API}}` (Hexagon)
  - `([User/Actor])` (Rounded)
  - `[Process/Service]` (Rectangle)
  - `{Decision/Logic}` (Diamond)

## 3. Structural Analysis Protocol
Before drawing, perform a **Structural Scan**:
1. Locate **Entry Points** (e.g., `main.py`, `index.ts`).
2. Identify the **State Layer** (e.g., `models.py`, schema files).
3. Map **External Bonds** (e.g., `package.json`, `requirements.txt`).

## 4. Post-Diagram Deliverables
Every diagram must include:
- **Data Flow Summary**: A 1-sentence path description (e.g., "User triggers API via HTTPS, which writes to Postgres").
- **Risk Assessment**: Identify one potential architectural bottleneck or risk.
