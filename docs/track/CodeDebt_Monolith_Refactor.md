# 📊 Code Health & Monolith Refactoring Tracker

> **Architecture Standard Reference**:
> - Global: `C:/Users/ASCC/.gemini/gemini.md` (Sections 1, 10, 12, 13)
> - Component Line Ceiling: **300–400 lines**
> - Backend Handler Ceiling: **400–500 lines**

---

## 📈 Overall Status

- **Total Files Exceeding Limits**: 29
- **Completed**: 18 / 28 (`SettingsPanel.tsx`, `VirtualLogTable.tsx`, `AIInvestigationSidebar.tsx`, `LayaSettingsPanel.tsx`, `handlers_logops.go`, `handlers_ai_extra.go`, `DashboardPage.tsx`, `TimeRangePicker.tsx`, `ImportFeedModal.tsx`, `InvestigationPage.tsx`, `OrchestratorHub.tsx`, `handlers_hierarchy.go`, `engine.go`, `tools.go`, `ingestionStore.ts`, `useLogIngestion.ts`, `CustomParserModal.tsx`, `app.go`)
- **Next Candidate**: Tier 3 monitored files or completion review

---

## 🚨 Tier 1: Critical Monoliths (> 1,000 Lines) — ALL RESOLVED 🎉

| Status | Lines | File Path | Layer | Target Architecture |
| :---: | :---: | :--- | :---: | :--- |
| 🟢 **Done** | ~~1,958~~ → **~350 avg** | `src/components/organisms/SettingsPanel.tsx` | Frontend | Modularized into `src/components/organisms/settings/` (Sections, Components & Utils) |
| 🟢 **Done** | ~~1,411~~ → **~150 avg** | `src/components/organisms/VirtualLogTable.tsx` | Frontend | Modularized into `src/components/organisms/log-table/` (Overlays, Cells, Drawer, Header) |
| 🟢 **Done** | ~~1,373~~ → **~210 avg** | `src/components/organisms/AIInvestigationSidebar.tsx` | Frontend | Modularized into `src/components/organisms/ai-sidebar/` (utils, AIMessageRow, ModelDropdown, InputBar, Shell) |
| 🟢 **Done** | ~~1,231~~ → **~120 avg** | `src/components/organisms/LayaSettingsPanel.tsx` | Frontend | Modularized into `src/components/organisms/laya-settings/` (Tabs, Modals, Hardware, Weights, Shell) |
| 🟢 **Done** | ~~1,146~~ → **~230 avg** | `backend-go/internal/app/handlers_logops.go` | Backend | Split into `handlers_logops_export.go`, `handlers_logops_fusion.go`, `handlers_logops_sampling.go`, `handlers_logops_jobs.go`, `handlers_logops_distribution.go` |

---

## ⚠️ Tier 2: Moderate Violations (500 – 1,000 Lines) — ALL RESOLVED 🎉

| Status | Lines | File Path | Layer | Notes & Target Split |
| :---: | :---: | :--- | :---: | :--- |
| 🟢 **Done** | ~~1,023~~ → **~310 avg** | `backend-go/internal/app/handlers_ai_extra.go` | Backend | Split into `handlers_ai_sessions.go`, `handlers_anomalies.go`, `handlers_dashboard.go` |
| 🟢 **Done** | ~~876~~ → **~90 avg** | `src/components/pages/DashboardPage.tsx` | Frontend | Modularized into `src/components/pages/dashboard/` (Header, Filters, Heatmap, Observation, Clusters, Canvas, Shell) |
| 🟢 **Done** | ~~874~~ → **~80 avg** | `src/components/molecules/TimeRangePicker.tsx` | Frontend | Modularized into `src/components/molecules/time-picker/` (Header, MonthGrid, YearGrid, Presets, Preview, Controls, Shell) |
| 🗑️ **Removed** | ~~739~~ | `backend-go/cmd/goldentest/main.go` | Tooling | Deleted obsolete migration golden test harness |
| 🟢 **Done** | ~~783~~ → **~130 avg** | `src/components/organisms/ImportFeedModal.tsx` | Frontend | Modularized into `src/components/organisms/import-modal/` (LocalTab, SshTab, ManualTab, LiveTab, Shell) |
| 🟢 **Done** | ~~771~~ → **~110 avg** | `src/components/pages/InvestigationPage.tsx` | Frontend | Modularized into `src/components/pages/investigation/` (Hooks, Modals, Sidebars, TableArea, Shell) |
| 🟢 **Done** | ~~728~~ → **~100 avg** | `src/components/organisms/OrchestratorHub.tsx` | Frontend | Modularized into `src/components/organisms/orchestrator/` (Header, Picker, FusionForm, TimeAlignment, AiContext, Footer, Shell) |
| 🟢 **Done** | ~~734~~ → **~230 avg** | `backend-go/internal/app/handlers_hierarchy.go` | Backend | Split into `handlers_hierarchy.go`, `handlers_logsources.go`, `handlers_workspace_lifecycle.go` |
| 🟢 **Done** | ~~756~~ → **~240 avg** | `backend-go/internal/ai/laya/engine.go` | Backend | Split into `decision.go`, `mock_engine.go`, `engine.go` |
| 🟢 **Done** | ~~717~~ → **~200 avg** | `backend-go/internal/ai/graph/tools.go` | Backend | Split into `tools.go` (registry), `tools_query.go` (logs/clusters/facets), `tools_rules.go` (memory/facets/laya) |
| 🟢 **Done** | ~~660~~ → **~110 avg** | `src/store/ingestionStore.ts` | State | Cleanly decomposed into `src/store/ingestion/` (`types.ts`, `trace.ts`, `importSlice.ts`, `trackingSlice.ts`, `pollingSlice.ts`, `index.ts`) without backward proxy; all 15 callers updated directly |
| 🟢 **Done** | ~~620~~ → **~90 avg** | `src/lib/hooks/useLogIngestion.ts` | Frontend | Modularized into `src/lib/hooks/ingestion/` (`localIngest.ts`, `remoteIngest.ts`, `manualIngest.ts`, `liveIngest.ts`, `duplicateIngest.ts`, `index.ts`) |
| 🟢 **Done** | ~~591~~ → **~80 avg** | `src/components/organisms/CustomParserModal.tsx` | Frontend | Modularized into `src/components/organisms/custom-parser/` (`types.ts`, `utils.ts`, `ParserHeader.tsx`, `SampleViewer.tsx`, `ExtractionPanel.tsx`, `SelectionToolbar.tsx`, `CustomParserModal.tsx`, `index.ts`) |
| 🟢 **Done** | ~~575~~ → **~175 avg** | `backend-go/internal/app/app.go` | Backend | Split into `app.go` (composition root), `app_drain.go` (miner caching/masking), `app_metadata.go` (resolver/settings) |

---

## 🟡 Tier 3: Soft Ceiling (400 – 500 Lines)

*Note: These files are cohesive. Only refactor if adding new features causes them to grow further.*

| Status | Lines | File Path | Layer |
| :---: | :---: | :--- | :---: |
| ⚪ Monitored | 495 | `backend-go/internal/ai/providers/gemini.go` | Backend |
| ⚪ Monitored | 493 | `backend-go/internal/app/handlers_query.go` | Backend |
| ⚪ Monitored | 469 | `src/components/organisms/DashboardCharts.tsx` | Frontend |
| ⚪ Monitored | 458 | `backend-go/internal/db/migrations.go` | Backend |
| ⚪ Monitored | 438 | `backend-go/internal/services/logstore/store.go` | Backend |
| ⚪ Monitored | 430 | `src/store/workspaceStore.ts` | Frontend |
| ⚪ Monitored | 414 | `backend-go/internal/ingestion/listeners.go` | Backend |
| ⚪ Monitored | 410 | `backend-go/internal/ai/providers/ollama.go` | Backend |
| ⚪ Monitored | 402 | `backend-go/internal/ai/providers/openai_compatible.go` | Backend |
| ⚪ Monitored | 402 | `src/components/organisms/Sidebar.tsx` | Frontend |
