# Global Architecture Diagrams (diagrams.md)

This document is the authoritative repository for Mermaid.js diagrams illustrating the end-to-end data flows, entity relationships, and dual-engine AI orchestration across the LogLensAi ecosystem.

## 👤 Persona: `@diagram-arch`
Expert in visual architecture mapping, C4 system context, and reactive sequence modeling.

---

## 📡 1. End-to-End Log Ingestion & Real-Time Laya Triage (Sequence Diagram)

This diagram illustrates how raw logs are ingested into DuckDB, clustered by Drain3 at >81,000 lines/sec, and asynchronously triaged by Laya System 1 into categories, 1–5 severity ratings, and outage flags without blocking the main ingestion path.

```mermaid
sequenceDiagram
  autonumber
  participant UI as VirtualLogTable & Dashboard (React 19)
  participant Store as useInvestigationStore / layaStore (Zustand)
  participant Bridge as useSidecarBridge.ts
  participant RPC as JSON-RPC Dispatcher (:5000 / Stdio)
  participant Ingest as FileTailer / Ingestion Pipeline (Go)
  participant DB as DuckDB (loglens.duckdb)
  participant Drain as Drain3 Clustering Engine (Go)
  participant Triage as LayaClusterTriager (Go)
  participant ONNX as ONNX ModernBERT Runtime (Q8)

  UI->>Store: Toggle Live Tail / Import Log File
  Store->>Bridge: callSidecar("start_tail", { filepath, workspace_id })
  Bridge->>RPC: {"jsonrpc": "2.0", "method": "start_tail", ...}
  RPC->>Ingest: Start streaming lines
  
  loop Continuous Streaming Batch
    Ingest->>DB: Batch INSERT skinny log rows
    Ingest->>Drain: IngestLog(workspace_id, raw_line)
    Note over Drain: Mines dynamic templates at >81k lines/sec
  end

  Drain->>Triage: OnClustersUpdated(clusterBatch)
  Note over Triage: Bounded concurrency (sem max 4)<br/>In-memory MD5 cache check

  par Async Cluster Triage
    loop For each untriaged cluster
      Triage->>ONNX: Predict(category, severity, is_outage)
      ONNX-->>Triage: {category: "database", severity: 4.8, is_outage: true}
      Triage->>DB: UPSERT INTO cluster_triage (workspace_id, cluster_id, ...)
    end
  and Live UI Poll / Event
    UI->>Store: fetchClusters() / fetchDashboardMetrics()
    Store->>Bridge: callSidecar("get_clusters", { workspace_id })
    Bridge->>RPC: {"jsonrpc": "2.0", "method": "get_clusters"}
    RPC->>DB: SELECT c.*, t.category, t.severity, t.is_outage FROM clusters c LEFT JOIN cluster_triage t...
    DB-->>RPC: Enriched cluster records
    RPC-->>Bridge: Result clusters with triage metadata
    Bridge-->>UI: Update ClusterRow badges & Dashboard alert cards
  end
```

---

## 🧠 2. Dual-Engine AI Investigation Architecture (State Machine & Fast Intent)

LogLensAi integrates a sub-30ms **System 1 (Laya ONNX ModernBERT)** fast classifier with a deep **System 2 (Generative LLM LangGraph)** reasoning engine.

```mermaid
flowchart TD
  User([User Investigation Query]) --> Intent[Laya System 1: Fast Intent Classifier]
  
  subgraph System1 ["System 1: Laya Fast Path (<30ms, Zero-VRAM)"]
    Intent --> ModeCheck{Confidence >= 0.85 & Single Tool Match?}
    ModeCheck -- Yes --> FastRoute[Inject Priority Routing Hint]
    ModeCheck -- No --> DefaultHint[Default Investigation Flow]
  end

  FastRoute --> StartLangGraph
  DefaultHint --> StartLangGraph

  subgraph System2 ["System 2: Generative Reasoning Engine (Deep)"]
    StartLangGraph((START)) --> Reason[Node: Reasoning State]
    
    Reason --> Decision{Action Required?}
    
    Decision -- "Tool Call Requested" --> Exec[Node: Tool Execution]
    Decision -- "Final Diagnosis" --> Final[Node: Final Answer]
    
    Exec --> Reason
    Final --> END((END))
  end

  subgraph ToolRegistry ["Available Diagnostic Tools"]
    Exec -- "get_logs" --> DBQuery[(DuckDB Logs Table)]
    Exec -- "analyze_cluster" --> DrainQuery[Drain3 Template Engine]
    Exec -- "search_memory" --> VSSQuery[(DuckDB-VSS Vector Memory)]
    Exec -- "update_laya_rules" --> LayaUpdate[Laya Rule & Checkpoint Store]
  end

  subgraph LLMProviders ["External LLM Providers"]
    Reason <--> Ollama[Ollama Local Engine]
    Reason <--> Gemini[Google Gemini API]
    Reason <--> OpenAI[OpenAI Compatible API]
  end

  Final --> RenderUI[Render Root Cause & Fix Suggestions in Chat]
```

---

## 🔍 2.1 Automatic RAG Cluster Memory Pre-Check (Sequence Diagram)

When an engineer analyzes a log cluster (or clicks "Diagnose" in the UI), `AnalyzeCluster` performs an automatic semantic similarity query against DuckDB-VSS to distinguish recurring incidents from new anomalies.

```mermaid
sequenceDiagram
  autonumber
  participant UI as DiagnosticSidebar & VirtualLogTable (React 19)
  participant Bridge as useSidecarBridge.ts
  participant RPC as JSON-RPC Dispatcher (:5000 / Stdio)
  participant Extra as Extra.AnalyzeCluster (Go)
  participant Drain as Drain3 Parser / Triage Cache
  participant RAG as RAG Memory Engine (DuckDB-VSS)
  participant Provider as External LLM Provider (Ollama / Gemini / OpenAI)
  participant DB as DuckDB (cluster_triage table)

  UI->>Bridge: callSidecar("analyze_cluster", { cluster_id, workspace_id })
  Bridge->>RPC: {"jsonrpc": "2.0", "method": "analyze_cluster", "params": {...}}
  RPC->>Extra: AnalyzeCluster(ctx, req)
  
  Extra->>Drain: Resolve cluster template & fetch sample logs
  Drain-->>Extra: Template string + Raw log samples
  
  Extra->>RAG: SearchMemory(ctx, workspace_id, template, topK=3)
  Note over RAG: Cosine distance calculation (sim = 1.0 - distance)
  RAG-->>Extra: Top memory matches & distance scores
  
  alt Cosine Similarity >= Threshold (Default 0.75)
    Note over Extra: Classified as KNOWN ISSUE
    Extra->>Extra: Set is_known_issue=true, tag="KNOWN ISSUE"<br/>Inject matched signature & prior resolution into prompt
  else Cosine Similarity < Threshold
    Note over Extra: Classified as NEW ANOMALY
    Extra->>Extra: Set is_known_issue=false, tag="NEW ANOMALY"
  end

  Extra->>DB: UpsertClusterRAGTag(workspace_id, cluster_id, tag, matchScore, knownResolution)
  
  Extra->>Provider: AnalyzeLogs(samples, enrichedPromptTemplate)
  Provider-->>Extra: Root cause analysis + recommended actions
  
  Extra-->>RPC: models.AnalyzeClusterResponse (with is_known_issue, tag, match_score, known_resolution)
  RPC-->>Bridge: JSON-RPC 2.0 Result
  Bridge-->>UI: Render DiagnosticSidebar with KNOWN ISSUE / NEW ANOMALY badges & prior fix
```

---

## 📐 3. Database Schema (Entity-Relationship Diagram)

DuckDB acts as the local columnar analytics and metadata storage engine.

```mermaid
erDiagram
  WORKSPACES ||--o{ LOGS : contains
  WORKSPACES ||--o{ CLUSTERS : registers
  WORKSPACES ||--o{ CLUSTER_TRIAGE : triages
  WORKSPACES ||--o{ FUSION_CONFIGS : orchestrates
  CLUSTERS ||--o{ LOGS : categorizes
  CLUSTERS ||--|| CLUSTER_TRIAGE : evaluated_by

  LOGS {
    bigint id PK
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
    bigint count
    timestamp created_at
    timestamp updated_at
  }

  CLUSTER_TRIAGE {
    varchar workspace_id PK, FK
    varchar cluster_id PK, FK
    varchar category
    double severity
    boolean is_outage
    double confidence
    timestamp evaluated_at
    timestamp updated_at
  }

  FUSION_CONFIGS {
    varchar workspace_id PK
    varchar fusion_id PK
    varchar source_id PK
    boolean enabled
    int tz_offset
  }

  SETTINGS {
    varchar key PK
    varchar value
    timestamp updated_at
  }
```

---

## 🏗️ 4. Frontend Component Hierarchy (React 19 & Tailwind v4)

```mermaid
graph TD
  App[App.tsx - 3-Column Shell] --> Sidebar[Sidebar Organism]
  App --> MainContent[Main Viewport]
  App --> DiagnosticSidebar[DiagnosticSidebar Organism]

  MainContent --> InvestigationPage[InvestigationPage]
  MainContent --> DashboardPage[DashboardPage]
  MainContent --> SettingsPage[SettingsPanel Modal / Overlay]

  InvestigationPage --> LogToolbar[LogToolbar Organism]
  InvestigationPage --> VirtualLogTable[VirtualLogTable Organism]
  InvestigationPage --> ClustersPanel[Clusters List]

  LogToolbar --> SearchBar[SearchBar Molecule]
  LogToolbar --> FilterBuilder[FilterBuilder Molecule]
  LogToolbar --> TailSwitch[TailSwitch Atom]

  VirtualLogTable --> LogRow[Virtual LogRow Component]
  LogRow --> LogLevelBadge[LogLevelBadge Atom]
  LogRow --> MessageCell[Highlighted Message Text]

  ClustersPanel --> ClusterRow[ClusterRow Molecule]
  ClusterRow --> SevBadge[Severity Badge (Sev 1.0-5.0)]
  ClusterRow --> OutageBadge[Animated OUTAGE Badge]
  ClusterRow --> CatBadge[Category Badge (database/network/auth...)]

  DashboardPage --> StatTiles[Cluster & Ingestion Metrics]
  DashboardPage --> OutageAlerts[Active Outage Banner Cards]

  SettingsPage --> GeneralTab[General Preferences]
  SettingsPage --> LayaTab[LayaSettingsPanel Organism]

  LayaTab --> ModelCard[Hugging Face Model Manager & Download Bar]
  LayaTab --> EngineToggle[Zero-VRAM CPU / GPU Switch]
  LayaTab --> RuleEditor[Visual Rule Builder & JSON Code Tabs]
  LayaTab --> Timeline[Checkpoints History & 1-Click Rollback]
```

---

## 🔄 5. Laya Model Manager & Rule Checkpoint Lifecycle

```mermaid
stateDiagram-v2
  [*] --> Uninitialized: First Launch

  Uninitialized --> CheckingLocalCache: Check weights in data/models/laya/
  
  CheckingLocalCache --> Ready: encoder_q8.onnx & head_q8.onnx present
  CheckingLocalCache --> MissingWeights: Weights not found
  
  MissingWeights --> Downloading: Trigger download_laya_model
  Downloading --> Downloading: Stream chunks to .part files
  Downloading --> Ready: Atomically rename .part -> .onnx
  Downloading --> Error: Network / Hash failure

  Ready --> ActiveInference: User enables Laya Engine
  
  state ActiveInference {
    [*] --> Idle
    Idle --> IngestionTriage: Drain3 cluster event
    Idle --> IntentClassify: User chat submission
    IngestionTriage --> Idle: Update cluster_triage table
    IntentClassify --> Idle: Provide fast routing hint
  }

  state RuleEvolution {
    [*] --> ActiveRules: Load from laya_rules.json
    ActiveRules --> UserEdit: Visual Builder / JSON Editor
    ActiveRules --> AIAutoImprove: System 2 calls update_laya_rules tool
    UserEdit --> NewCheckpoint: Save with author & description
    AIAutoImprove --> NewCheckpoint: Auto-save checkpoint
    NewCheckpoint --> ActiveRules: Reload in-memory RuleManager
    NewCheckpoint --> Rollback: 1-Click Rollback to prior snapshot
    Rollback --> ActiveRules: Restore prior state
  }
```
