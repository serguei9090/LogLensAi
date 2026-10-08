# Architectural Specification: In-Chat Generative A2UI Studio & AI Session Isolation

> **Status**: Proposed Specification  
> **Target**: Dashboard AI Insights (`src/components/pages/dashboard/components/AICanvasView.tsx`) & AI Stores (`src/store/aiStore.ts`)  
> **Philosophy**: Google A2UI (Agent-to-UI) Conversational Generative Studio. Replace the empty dot-grid canvas with a first-class in-stream Generative AI Studio, and isolate Dashboard telemetry chats from Investigation log chats.

---

## 1. Problem Statement & Root Cause

1. **Shared Session Collision**:
   - `InvestigationPage` and `DashboardPage (AI Insights mode)` share the exact same global `aiStore.ts` session (`currentSessionId`, `messages`).
   - When users chat about log troubleshooting on the Investigation page, that log analysis history is mirrored directly onto the Dashboard AI Insights tab.
2. **Empty Canvas Bug**:
   - `AICanvasView.tsx` splits the screen into an empty dot-grid canvas on the left and a cramped 450px sidebar on the right.
   - The canvas relies on `dashboardWidgets` auto-pinning by regex on stream completion, which rarely triggers and leaves users staring at:
     > *"No widgets pinned yet. Ask the AI to create a dashboard card."*
3. **Misalignment with Google A2UI Standard**:
   - Google A2UI is designed for **conversational dynamic UI** (Generative UI): interactive widgets (live metrics, timeline charts, data tables, action drill-down buttons) appear **directly in the chat stream** as part of the assistant's response.

---

## 2. Target Architecture

```
LogLensAi AI System
├── 1. Investigation Page (Log Troubleshooting)
│   ├── Purpose: Root-cause analysis, stack trace inspection, cluster triage
│   ├── Scope: Bound to specific log rows, queries, and filters
│   └── Storage: investigationAiStore (or session_type = "investigation")
│
└── 2. Dashboard Page: AI Insights (Generative A2UI Studio)
    ├── Purpose: Telemetry synthesis, health overview, anomaly discovery
    ├── Scope: Full-workspace analytics with interactive inline A2UI cards
    ├── Layout: Expansive full-width conversational studio (no empty canvas, no narrow sidebar)
    └── Storage: dashboardAiStore (or session_type = "dashboard")
```

---

## 3. What Needs to Be Implemented

### A. AI Session Isolation (`session_type: "investigation" | "dashboard"`)
- Update `AiSession` and `aiStore` so sessions are tagged or isolated by type.
- Switching between Investigation Page and Dashboard AI Insights automatically swaps to the appropriate session list without history bleeding between views.

### B. Full-Window In-Chat Generative Studio (`AIInsightsStudio.tsx`)
- Replace the awkward dot canvas + 450px sidebar with `AIInsightsStudio`:
  - **Hero Header / Telemetry Context Bar**: Workspace picker, time range bounds, AI model selector, and clear/new chat buttons.
  - **Expansive Chat Thread**: Full-width, conversational UI with:
    - AI thinking steps and execution progress.
    - Markdown synthesis.
    - **Inline A2UI Widgets**: Live metric counters (`metric`), time-series trend graphs (`chart_area`), anomaly data tables (`data_table`), and interactive action chips (`button action={...}`).
  - **Quick Telemetry Prompt Starters**:
    - *"Analyze error distribution across all sources in the last 24h"*
    - *"Identify anomalous Drain3 cluster spikes"*
    - *"Compare HTTP vs Syslog error rates"*
  - **Rich Input Bar**: Multiline prompt bar with model selection and reasoning toggle.

### C. A2UI Action Interactivity
- Wire `onA2UIAction` in `A2UIRenderer`:
  - When a user clicks a button inside an in-chat A2UI widget (e.g. `Filter by ERROR` or `View Cluster #42`), dispatch navigation or cross-page filtering directly into `InvestigationPage`.

---

## 4. What Needs to Be Removed / Refactored

| Action | Target | Rationale |
| :--- | :--- | :--- |
| **Remove** | `src/components/pages/dashboard/components/AICanvasView.tsx` (dot-grid canvas) | The dot grid is a false canvas that causes confusion and stays empty. |
| **Remove** | `dashboardWidgets` store state & auto-pinning regex in `aiStore.ts` | Widgets belong natively in the conversational stream (true A2UI). |
| **Refactor** | `DashboardPage.tsx` | Render `AIInsightsStudio` in place of `AICanvasView` when `mode === "ai"`. |
| **Refactor** | `aiStore.ts` | Add session isolation (`sessionType: "dashboard" \| "investigation"`) so the two workspaces don't clash. |
| **Enhance** | `A2UIRenderer.tsx` | Ensure full responsiveness across full-width chat layouts with shadcn cards and theme tokens. |

---

## 5. Verification Plan
1. `bun run build` verifies zero TypeScript compilation issues.
2. Check that Investigation chat history does NOT leak into Dashboard AI Insights.
3. Test that asking for telemetry analysis renders the A2UI widgets directly inside the chat flow.
