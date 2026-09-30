# Specification: Laya AI System 1 Decision Engine & Auto-Improvement Pipeline

**Spec ID:** `FEAT_LAYA_SYSTEM1_ENGINE`  
**Status:** Approved / Planned  
**Target Stack:** React 19 (TypeScript, Vite, Tailwind v4, Tauri v2) + Go Sidecar Backend (`marcboeker/go-duckdb`, `yalue/onnxruntime_go`)  

---

## 🎯 Objective & Architectural Scope

Integrate **Laya AI** (`nvkudva/laya-web-q8` 8-bit ONNX ModernBERT-large decision engine, ~524MB) into LogLensAi as a low-latency **"System 1" reflexive adapter**. 

1. **Pre-LLM Fast Router:** Classifies user query intents and dispatches direct DuckDB queries (`search_logs`, `get_clusters`) in ~30ms without invoking costly generative LLMs (System 2).
2. **Post-Drain3 Cluster Triage:** Automatically scores mined cluster templates (category, severity 1-5, outage alerts) in batch during log analysis.
3. **Dedicated Settings Tab:** Comprehensive UI/UX in React with On/Off toggle, Hardware mode (CPU Zero-VRAM vs GPU DirectML/CUDA), Visual Rule Builder, Raw JSON Code viewer/editor, and 1-click Checkpoint Rollback.
4. **AI Auto-Improvement Tool:** A dedicated tool (`update_laya_rules`) enabling System 2 LLMs to autonomously refine rule prompts and commit versioned checkpoints based on real investigation feedback.

---

## 🗺️ Step-by-Step Task Breakdown

### 📦 Phase 1: Go Backend Laya Engine & Rule Store
- [x] **Task 1.1: Rule Schema & Checkpoint Manager** (`backend-go/internal/ai/laya/rules.go`)
  - Define `RuleSet`, `Checkpoint`, `Question`, `QuestionType` (`choice`, `score`, `noul`).
  - Read/write `config/laya_rules.json` with thread-safe atomic file swapping (`.tmp` -> `.json`).
  - Implement `RollbackToCheckpoint(checkpointID string) error`.
  - Provide default baseline rules for log triage (`severity`, `category`, `is_outage`, `tool_intent`).
- [x] **Task 1.2: ModernBERT Sequence Formatter & Tokenizer** (`backend-go/internal/ai/laya/sequence.go`)
  - Format input sequences: `[CLS] <type> question: <instructions> [SEP] [MASK] opt0 [MASK] opt1 ... [SEP] <state> [SEP]`.
  - Standalone pure-Go WordPiece tokenizer matching ModernBERT specifications.
- [x] **Task 1.3: ONNX Runtime Engine** (`backend-go/internal/ai/laya/engine.go`)
  - Load `encoder_q8.onnx` and `head_q8.onnx` via `github.com/yalue/onnxruntime_go`.
  - Support execution providers: CPU (OpenMP, 0 MB VRAM) and GPU (DirectML / CUDA).
  - Implement forward pass, temperature scaling, and calibrated softmax extraction.
- [x] **Task 1.4: JSON-RPC API Handlers** (`backend-go/internal/app/handlers_laya.go` & `backend-go/internal/rpc/`)
  - `get_laya_settings`: Returns enabled status, hardware mode, active checkpoint, rules.
  - `update_laya_settings`: Updates enabled status & hardware mode.
  - `get_laya_checkpoints`: Returns historical checkpoints list.
  - `rollback_laya_checkpoint`: Reverts active rules to specified checkpoint ID.
  - `save_laya_rules`: Manually saves updated rules as a new checkpoint.
  - `test_laya_rule`: Evaluates a sample log snippet/query against active or draft rules.

---

### 🤖 Phase 2: AI Auto-Improvement Tool & System 1 Routing
- [x] **Task 2.1: Auto-Improvement Tool for System 2 LLM** (`backend-go/internal/ai/graph/tools.go`)
  - Register tool: `update_laya_rules`.
  - Schema: `{ "rationale": string, "question_name": string, "type": string, "instructions": string, "options"?: string[], "rubric"?: int[] }`.
  - Execution: Validates, updates question map, and commits atomic checkpoint with AI author audit.
- [x] **Task 2.2: Pre-LLM Routing Hook in AI State Machine** (`backend-go/internal/ai/graph/graph.go`)
  - Before calling `nodeReasoning`, evaluate query with `RouteWithLaya` against `tool_intent`.
  - Annotates high-confidence routing (`>= 0.85`) to accelerate tool execution.
- [x] **Task 2.3: Post-Drain3 Cluster Enrichment Service** (`backend-go/internal/services/clustering/`, `internal/app/laya_triage.go`, `internal/db/clustering_triage.go`)
  - Created `cluster_triage` DuckDB table and CRUD operations.
  - Added `ClusterTriageHandler` to clustering worker; asynchronously triages newly discovered templates.
  - Implemented `LayaClusterTriager` scoring category, severity, and outage indicators in background goroutines.
  - Enriched `GetClusters` and Dashboard queries with triage metadata.
  - Rendered category, severity, and outage badges on `ClusterRow` in Dashboard and Investigation views.
- [x] **Task 2.4: Automated Hugging Face Model Downloader** (`backend-go/internal/ai/laya/downloader.go`)
  - Implemented `ModelManager` with atomic file downloads (`encoder_q8.onnx` and `head_q8.onnx`, ~524MB total).
  - Added JSON-RPC endpoints: `get_laya_model_status` and `download_laya_model`.
  - Auto-triggers background download when user enables Laya and weights are missing.
  - Added progress tracking bar, download button, and readiness badges in `LayaSettingsPanel.tsx`.

---

### 🎨 Phase 3: React Settings Page & Dedicated Laya Panel
- [x] **Task 3.1: Settings Store & IPC Client** (`src/store/layaStore.ts` & `src/types/laya.ts`)
  - Added Laya state: `enabled`, `device` (`cpu` | `gpu`), `active_checkpoint`, `questions`, `checkpoints`.
  - Added actions: `fetchSettings`, `updateSettings`, `fetchCheckpoints`, `rollbackCheckpoint`, `saveRules`, `testRule`.
- [x] **Task 3.2: Laya Section in Settings Navigation** (`src/components/organisms/SettingsPanel.tsx`)
  - Added `{ id: "laya", icon: Zap, label: "Laya System 1", desc: "Fast router & rules engine" }` to `SECTIONS`.
- [x] **Task 3.3: Dedicated Laya Settings View** (`src/components/organisms/LayaSettingsPanel.tsx`)
  - **Master Switch & Hardware Selector:** Enable/Disable toggle + CPU (0 MB VRAM) vs GPU radio cards.
  - **Visual Rule Builder:** Interactive form to add/edit questions, options, rubrics, and instructions.
  - **Raw JSON Code Viewer / Editor:** Dual-mode tab with live JSON linting, formatting, and manual editing.
  - **Checkpoint History & Rollback:** Timeline of checkpoints with author, date, description, and 1-click Rollback button.
  - **Live Test Playground:** Quick tester input to verify rule predictions against sample log lines.

---

## 📁 File Manifest

| File Path | Role | Action |
| :--- | :--- | :--- |
| `backend-go/internal/ai/laya/rules.go` | Rule store, JSON parser, rollback engine | Create |
| `backend-go/internal/ai/laya/sequence.go` | Prompt/sequence construction & masked token builder | Create |
| `backend-go/internal/ai/laya/engine.go` | ONNX Runtime loader, forward pass, CPU/GPU switcher | Create |
| `backend-go/internal/ai/laya/types.go` | Go struct definitions for rules, checkpoints, decisions | Create |
| `backend-go/internal/app/handlers_laya.go` | JSON-RPC 2.0 handlers for Laya settings & testing | Create |
| `backend-go/internal/ai/graph/tools.go` | Register `update_laya_rules` tool for LLM | Edit |
| `backend-go/internal/ai/graph/graph.go` | Pre-LLM System 1 routing adapter | Edit |
| `src/types/laya.ts` | TypeScript interfaces for Laya rules & checkpoints | Create |
| `src/store/settingsStore.ts` | Zustand store actions for Laya IPC calls | Edit |
| `src/components/organisms/SettingsPanel.tsx` | Wire `laya` section tab | Edit |
| `src/components/organisms/LayaSettingsPanel.tsx` | Full visual UI, JSON editor, history, and test runner | Create |
