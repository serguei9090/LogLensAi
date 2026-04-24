# 🏛️ Architecture & Documentation Audit
**Location:** `docs/track/audits/ARCHITECTURE_AUDIT.md`  
**Date:** April 2026  

**Objective:** Evaluate the completeness and quality of all architecture-level documentation — designer assets, frontend structure, backend API, middleware, diagrams, and the AI layer.

---

## 🎨 1. Designer / Theme Layer

**File:** `docs/Documentation/design/theme.md` — **✅ EXCELLENT**

This is the best-maintained doc in the entire project. It includes:
- ✅ Full 9-section color palette with hex + CSS token + Tailwind alias.
- ✅ Typography scale (Inter + JetBrains Mono).
- ✅ Glassmorphism standards.
- ✅ Z-index portal stack.
- ✅ Animation standards.
- ✅ Known Guardrails section (Auto-Improved rules from real production bugs).

**Gaps / Actions:**
- 🟡 **Missing**: Iconography guide. Which Lucide React icons are standardized per action type (e.g., "always use `AlertTriangle` for WARN, never `Warning`")? Hallucinated icon names are a recurring AI bug.
- 🟡 **Missing**: A "Do / Don't" code example section. The guardrails exist but have no visual reference for the Flash model.

---

## 🖥️ 2. Frontend Layer

**File:** `docs/Documentation/architecture/layers/frontend.md` — **🟡 INCOMPLETE**

**Gaps / Actions:**
- 🔴 **Missing**: The frontend architecture doc exists but is likely a stub. The actual Atomic Design component tree in `src/components/` is extensive but NOT documented. We have:
  - 10 Atoms, 10 Molecules, 15 Organisms, 2 Templates, 3 Pages, 20 Shadcn UI Primitives.
  - None of these have a corresponding registry entry in `docs/Documentation/design/ui-components.md`.
- 🟡 **Missing**: Zustand store map. We have multiple stores (`workspaceStore`, `investigationStore`, `aiStore`, etc.) but no diagram showing which component reads from which store.

---

## ⚙️ 3. Backend / Sidecar Layer

**File:** `docs/Documentation/architecture/layers/backend.md` — **🟡 PARTIALLY COMPLETE**

**Gaps / Actions:**
- 🔴 **Missing**: `anomalies.py`, `ingestion.py`, `metadata_extractor.py`, `mcp_server.py`, and `models.py` are all undocumented. These are non-trivial modules and have no reference in any documentation.
- 🟡 **Present but outdated**: `core_functions.md` was recently updated, but it does not yet cover the full AI layer methods (`analyze_cluster`, `get_ai_sessions`, etc.).
- ✅ `db.py` thread-safety rules (`get_cursor()`) are well-documented in `AGENTS.md`.

---

## 🌐 4. API / Middleware Layer

**File:** `docs/Documentation/reference/API_SPEC.md` — **🟡 MOSTLY COMPLETE**

- ✅ Core log methods (`get_logs`, `update_log_comment`) are documented.
- ✅ AI methods (`create_ai_session`, `send_ai_message`, `get_ai_sessions`) are documented.
- 🔴 **Missing**: The following JSON-RPC methods exist in `api.py` but are NOT in the API_SPEC:
  - `start_tail`, `stop_tail`, `is_tailing` (Real-time tailing)
  - `start_ssh_tail`, `stop_ssh_tail` (SSH tailing)
  - `ingest_logs`, `delete_logs`, `export_logs` (Log ingestion)
  - `get_hierarchy`, `create_folder`, `move_source` (Workspace tree)
  - `factory_reset` (Danger zone)
- 🟡 **Drift**: `core_functions.md` and `API_SPEC.md` are partially duplicating each other. Recommend consolidating into one canonical reference.

---

## 📐 5. Architecture Diagrams

**File:** `docs/Documentation/architecture/diagrams.md` — **✅ HEALTHY**

- ✅ E2E Sequence Diagram (Live Tail Flow) — Excellent and accurate.
- ✅ Database Schema (ER Diagram) — Accurate.
- ✅ AI Layer flow diagram (LangGraph state machine) — Added.
- ✅ Fusion Mode sequence diagram — Added.
- ✅ SSH Tail sequence diagram — Added.

---

## 🛠️ 4. Layout & Design System

**Files:** `docs/Documentation/design/theme.md`, `docs/Documentation/design/ui-components.md` — **✅ HEALTHY**

- ✅ Theme guide updated with standardized Lucide iconography mappings.
- ✅ Full UI Component Registry (45+ components) created in `ui-components.md`.
- 🟢 High consistency with atomic design principles.

---

## 🔧 5. Infrastructure & Layers

**Files:** `docs/Documentation/architecture/layers/backend.md` — **✅ HEALTHY**

- ✅ Sidecar modules table updated to include `anomalies`, `ingestion`, `metadata_extractor`, `mcp_server`, `models`, and `query_parser`.
- 🟢 Backend architecture now fully mapped from API to persistence.

---

## 🤖 6. AI Layer

**Files:** `docs/Documentation/architecture/ai_parsing.md`, `docs/Documentation/architecture/gemini.md` — **🟡 IMPROVING**

- ✅ LangGraph state machine diagram created in `diagrams.md`.
- 🟡 Individual AI modules (`ai_studio.py`, `ollama.py`, etc.) still need detailed summary documentation.

---

## 📋 Recommended Priority Fixes

| Priority | Action | File | Status |
|---|---|---|---|
| **P0** | Document missing API methods in `API_SPEC.md` | `docs/Documentation/reference/API_SPEC.md` | ✅ Done |
| **P0** | Create AI Layer flow diagram (LangGraph state machine) | `docs/Documentation/architecture/diagrams.md` | ✅ Done |
| **P1** | Create UI Component Registry (all 45+ components) | `docs/Documentation/design/ui-components.md` | ✅ Done |
| **P1** | Document undocumented sidecar modules | `docs/Documentation/architecture/layers/backend.md` | ✅ Done |
| **P2** | Add Lucide icon standards to theme guide | `docs/Documentation/design/theme.md` | ✅ Done |
| **P2** | Consolidate `core_functions.md` and `API_SPEC.md` | `docs/Documentation/reference/` | ✅ Done |
