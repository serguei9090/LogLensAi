# 📊 Visual Architecture Diagrams

> **Init Selector** — Check the diagram types relevant to this project. The AI will generate and maintain the checked diagrams throughout the project lifecycle.

<!-- AI_PROMPT: If no diagram types are checked below, review `stack.md` and `communication.md`
     to determine which diagrams best capture this project's architecture. Propose the top 3.
     Once confirmed, generate an initial draft for each selected type using the diagram-creator skill. -->

---

## 🎨 Diagram Type Selection

- [ ] **System Context Diagram (C4 Level 1)** — How this system fits in the broader environment
- [ ] **Container Diagram (C4 Level 2)** — High-level tech containers (Frontend, Backend, DB, etc.)
- [x] **Sequence Diagram** — Frontend → Backend → DB request/response flow *(default: always)*
- [ ] **Component Diagram (C4 Level 3)** — Internal structure of a container
- [x] **ERD (Entity Relationship Diagram)** — Database schema relationships *(default: when DB exists)*
- [ ] **State Machine Diagram** — State transitions for complex UI flows or agentic loops
- [ ] **Data Flow Diagram (DFD)** — How data moves through the full system
- [ ] **Deployment Diagram** — Infrastructure topology (Docker, Cloud, Tauri packaging)
- [ ] **AI Agent Orchestration Diagram** — Agent→Tool→Agent delegation map (AVAS standard)
- [ ] **Atomic Design Component Map** — Atoms → Molecules → Organisms hierarchy

---

## 📐 Diagram Specifications

### 🔄 Sequence Diagram *(checked by default)*

> Update this diagram whenever a new API method is added to `communication.md`.

```mermaid
sequenceDiagram
    participant User
    participant FE as Frontend
    participant Bridge as Bridge Hook
    participant BE as Backend (Sidecar)
    participant DB as Database

    User->>FE: Trigger Action
    FE->>Bridge: callSidecar("method_name", params)
    Bridge->>BE: JSON-RPC Request
    BE->>DB: Query / Mutation
    DB-->>BE: Result Set
    BE-->>Bridge: JSON-RPC Response
    Bridge-->>FE: Typed Result
    FE-->>User: Update UI
```

---

### 🗄️ Entity Relationship Diagram *(checked by default)*

> Update this diagram when `layers/backend.md` database schema changes.

```mermaid
erDiagram
    PROJECT ||--o{ ENTITY : contains
    ENTITY ||--o{ RECORD : has
```

---

### 🏗️ Container Diagram (C4 L2) *(fill when checked)*

```mermaid
graph TD
    subgraph "User's Machine"
        FE["Frontend\n(React / Tauri)"]
        BE["Backend Sidecar\n(Python / FastAPI)"]
        DB[(Database\nDuckDB / SQLite)]
    end
    FE -- "Bridge Protocol" --> BE
    BE -- "Query" --> DB
```

---

### 🤖 AI Agent Orchestration Diagram *(fill when checked)*

> Follow AVAS standard: use subgraphs and labeled connections. Activate `diagram-creator` skill.

```mermaid
graph TD
    User([User]) --> Antigravity{Antigravity}
    subgraph "Local Execution"
        Antigravity --> Agent1["Agent 1"]
        Agent1 --> Tool1["Tool 1"]
    end
```

---

### 🎯 State Machine Diagram *(fill when checked)*

```mermaid
stateDiagram-v2
    [*] --> Idle
    Idle --> Loading : trigger
    Loading --> Success : result
    Loading --> Error : failure
    Error --> Idle : retry
    Success --> Idle : reset
```

---

## 🔗 References

- **AVAS Law**: `.agents/rules/Specialized/VisualArchitecture.md`
- **Diagram Skill**: `.agents/skills/diagram-creator/`
- **Communication Flow**: `docs/architecture/communication.md`
- **DB Schema**: `docs/architecture/layers/backend.md`
