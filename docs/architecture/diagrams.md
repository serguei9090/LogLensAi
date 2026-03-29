# Global Architecture Diagrams (diagrams.md)

This document is the repository for complex Mermaid.js diagrams that span multiple layers of the LogLensAi system.

## 👤 Persona: `@diagram-arch`
Expert in visual architecture mapping and C4-modeling. Focuses on system interoperability.

## 📡 End-to-End Request Flow (Sequence Diagram)

This diagram shows how a user action (e.g., clicking the "Live Tail" switch) moves through the entire system.

```mermaid
sequenceDiagram
  participant UI as LogToolbar (React)
  participant Store as useInvestigationStore (Zustand)
  participant Bridge as useSidecarBridge.ts
  participant API as api.py (Python)
  participant Tailer as tailer.py (Python)
  participant DB as loglens.duckdb (DuckDB)

  UI->>Store: setTailing(true)
  Store->>Bridge: callSidecar("start_tail", { filepath })
  Bridge->>API: JSON-RPC (stdin)
  API->>Tailer: FileTailer.start()
  
  loop Every 500ms
    Tailer->>File: read offset
    Tailer->>Parser: parse(line)
    Parser->>DB: INSERT INTO logs
  end

  API-->>Bridge: { "status": "started" }
  Bridge-->>UI: Update UI state (Green Pulse)
```

## 📐 Database Schema (Entity-Relationship)

```mermaid
erDiagram
  WORKSPACES ||--o{ LOGS : contains
  WORKSPACES ||--o{ CLUSTERS : registers
  WORKSPACES ||--o{ FUSION_CONFIGS : orchestrates
  CLUSTERS ||--o{ LOGS : categorizes
  
  LOGS {
    int id PK
    timestamp timestamp
    varchar level
    varchar source_id
    text raw_text
    text message
    varchar cluster_id FK
    boolean has_comment
  }
  
  CLUSTERS {
    varchar workspace_id PK
    varchar cluster_id PK
    text template
    int count
  }

  FUSION_CONFIGS {
    varchar workspace_id PK
    varchar fusion_id PK
    varchar source_id PK
    boolean enabled
    int tz_offset
  }
```

## 🏗️ UI Component Tree (High-Level)

```mermaid
graph TD
  AppLayout --> Sidebar
  AppLayout --> InvestigationLayout
  
  InvestigationLayout --> LogToolbar
  InvestigationLayout --> VirtualLogTable
  
  LogToolbar --> SearchBar
  LogToolbar --> FilterBuilder
  LogToolbar --> HighlightBuilder
  LogToolbar --> TailSwitch
  
  VirtualLogTable --> LogRow
  LogRow --> LogLevelBadge
  LogRow --> HighlightedMessage
```
