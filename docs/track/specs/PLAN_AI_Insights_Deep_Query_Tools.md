# Implementation Plan: AI Insights Deep Query Tools & Intelligent A2UI Rendering

## Overview
Enable the AI Insights Assistant to autonomously analyze timeline distributions, error spikes, and log history through rich dynamic query tools. Connect user requests for visual data (graphs, trends, histories, metrics) to interactive A2UI components without requiring users to type `A2UI` keywords, while keeping token consumption minimal by fetching large dataset aggregations directly on the frontend.

---

## 1. Architecture & Design Rationale

### The "Data-Bound Blueprint" Paradigm
- **Problem**: Passing thousands of log rows to the LLM slows responses down and risks context limits.
- **Solution**:
  1. The LLM invokes lightweight summarization tools (such as `get_log_timeline`) to see aggregate bucket stats (e.g. `12 errors at 10:00`, `450 total logs`).
  2. The LLM emits a high-level UI blueprint tag (`[[A2UI]] chart_area title="..." query="..." [[/A2UI]]`).
  3. The frontend React component `<LiveChartArea>` executes `get_log_distribution` in the local DuckDB sidecar and renders an interactive ECharts time-series histogram directly inside the chat.

```
User Query: "Show me a graph history of errors over the last 24 hours"
    │
    ▼
Go Agent State Machine (backend-go)
    ├── Tool Call: get_log_timeline(query="level:ERROR", start_time=..., end_time=...)
    │   └── Returns small aggregate JSON (buckets + counts)
    ├── Synthesizes text summary
    └── Appends A2UI Blueprint: [[A2UI]] chart_area title="Error History" query="level:ERROR" [[/A2UI]]
    │
    ▼
React Frontend (A2UIRenderer.tsx)
    ├── Strips [[A2UI]] text from Markdown chat bubble
    └── Mounts <LiveChartArea title="Error History" query="level:ERROR">
        └── Queries DuckDB Sidecar RPC: get_log_distribution
        └── Renders interactive ECharts area chart with zoom and level bars
```

---

## 2. Changes to Backend Sidecar (`backend-go/`)

### A. New Tool: `get_log_timeline` in `internal/ai/graph/tools.go` & `tools_query.go`
- **Tool Name**: `get_log_timeline`
- **Purpose**: Allows the AI to query log counts grouped by time buckets across any LLQL query and time range.
- **Inputs**:
  - `workspace_id` (string, required)
  - `query` (string, optional LLQL filter, e.g. `level:ERROR`, `status:500`)
  - `start_time` (string, optional)
  - `end_time` (string, optional)
  - `source_ids` (array of strings, optional)
- **Implementation**:
  - Invokes `r.app.GetLogDistribution(req)` from `handlers_logops_distribution.go`.
  - Returns a compact JSON summary of the buckets: `[{"bucket": "2026-05-26 19:00", "DEBUG": 10, "INFO": 150, "ERROR": 2}]`.
  - Limits output to at most 50 buckets so it stays lightweight in the LLM's context.

### B. Natural Semantic Triggers in `internal/ai/graph/graph.go`
- Update the system prompt so that whenever the user mentions:
  - *"graph"*, *"chart"*, *"history"*, *"timeline"*, *"trend"*, *"over time"*, *"spikes"* -> the model calls `get_log_timeline` and emits a `<chart_area>` A2UI tag.
  - *"metric"*, *"amount"*, *"total"*, *"count"*, *"rate"* -> the model emits a `<metric>` A2UI tag.
  - *"table"*, *"list of recent"*, *"details"* -> the model emits a `<data_table>` A2UI tag.
  - *"filter"*, *"drill down"*, *"action"* -> the model emits a `<button>` A2UI tag.

---

## 3. Changes to Frontend UI (`src/`)

### A. Implement `<LiveChartArea>` in `src/components/atoms/A2UIRenderer.tsx`
- Replace the fallback `LiveMetric` with a dedicated `<LiveChartArea>` component:
  - Accepts `title`, `query`, optional `startTime`, `endTime`.
  - Calls `get_log_distribution` from the sidecar via `callSidecar`.
  - Renders a compact, dark-mode ECharts bar/area chart using `ReactECharts`.
  - Styled with project tokens (`bg-bg-surface/60 border-border/60`).
  - Supports clicking any bar/bucket to trigger an action (e.g. filter by time or query).

### B. Enhanced Tag Parsing for Chart Area
- Support parameters in markup:
  `chart_area title="Log Distribution" query="level:ERROR"`

---

## 4. Verification & Testing

1. **Go Verification**:
   - Run `go test ./...` in `backend-go` to ensure new tools and handlers compile and pass all tests.
2. **Frontend Verification**:
   - Run `bun test` and `bun run build` to verify type safety and bundle generation.
   - Run `biome check` to ensure clean linting and formatting.
3. **End-to-End Test**:
   - Submit prompt: *"show me a graph history of logs in the workspace"* and verify that an interactive chart widget renders without any visible `[[A2UI]]` markup in the chat.
