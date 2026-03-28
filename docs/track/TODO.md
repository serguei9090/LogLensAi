# LogLensAi - TODO

> Last updated: 2026-03-28
> Source of truth for all sprint work. All Jules sessions must be anchored to items here.

---

## ✅ Done
- [x] Project genesis & scaffolding (AGENTS.md, rules, lefthook)
- [x] Core Python sidecar: DuckDB, Drain3, JSON-RPC API
- [x] Local file tailer (FileTailer)
- [x] SSH remote tailer (SSHLoader)
- [x] Basic React shell with Tauri v2
- [x] Workspace management & source isolation
- [x] Investigation Layout with unified tabs (Fusion tab)
- [x] Sidecar Stabilization (CORS, 127.0.0.1 binding)
- [x] **FUSION-001**: `FusionConfigEngine` layout (Checklist + Timezone + Parser Status)
- [x] **FUSION-002**: Persistent source configurations via `fusion_configs` in DuckDB
- [x] **FUSION-003**: Sidecar — Implement `get_fused_logs` for optimized multi-source querying

---

## 🔵 Sprint 02 — Fusion Engine (High Priority)

### P1 — Advanced Parsing & Normalization (Active)
- [ ] **PARS-001**: `CustomParserModal` UI (Sample lines + interactive highlighter)
  - Detail: `docs/TODOC/FEAT-PARS-001.md`
- [ ] **PARS-002**: Sidecar — Dynamic regex generation from user-selected timestamp ranges
- [ ] **PARS-003**: Sidecar — Integrate regex parser into `FileTailer` and `Ingest` flows
- [ ] **PARS-004**: Timezone normalization logic in sidecar (UTC conversion)

---

## 🟡 Sprint 03 — Analysis & Insights

### P0 — AI Integration
- [ ] **AI-001**: Implement `analyze_cluster` calling the `gemini-cli`
- [ ] **AI-002**: Display AI explanation in a side drawer for a selected cluster
- [ ] **AI-003**: Root cause analysis suggestion based on cluster samples

---

## ⚪ Backlog (Future Sprints)
- [ ] **DASH-001**: Dashboard page (placeholder nav item)
- [ ] **EXPORT-001**: Export filtered logs to CSV / JSON
- [ ] **KEYBIND-001**: Keyboard shortcuts (⌘K command palette)
- [ ] **TEST-00x**: Generic Vitest/Pytest coverage
