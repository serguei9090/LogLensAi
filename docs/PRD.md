# {{PROJECT_NAME}} - PRD (Product Requirements Document)

## Vision & Overview
LogLensAi is a state-of-the-art desktop log analysis and diagnostic engine. It bridges raw, millions-of-lines log data with intelligent, AI-driven diagnostics using a high-performance Tauri/DuckDB architecture.

## MVP Core Protocol (Phases 1-5)
- [x] Local File Ingestion (Gigabyte scale via JSON-RPC to Python).
- [x] High-Speed Virtual Grid rendering (TanStack Virtual).
- [x] Basic Structural Filtering (Level/Text).

## Advanced Architecture (Phases 6+)
Because the project strictly adheres to **Hexagonal Architecture (Ports & Adapters)**, advanced capabilities will be loaded seamlessly as isolated modules without breaking the core engine. These include:
- **Live Tailing**: Real-time log mounting with auto-scroll.
- **Remote Ingestion (SSH)**: Connect to remote servers (User/Pass/Key) to tail/download logs securely.
- **AI-Insight Engine**: Select a single log or a `Drain3` cluster and stream it to a configured AI Provider (OpenAI/Anthropic/Local) for instant root-cause analysis.
- **Multi-File Chrono-Merge**: Ability to load multiple log files from different microservices and interleaving them by a normalized timestamp.
- **Dashboarding**: Dedicated "Time-Frame" views with Lucide-styled metrics (Error spikes over 15m intervals).
- **Tabbed Workspaces**: Modular UI allowing the user to have multiple parsed logs open simultaneously.

## Architectural Boundaries
- Frontend: `React 19, Tauri v2, Zustand v5` (Atomic Design UI)
- Backend: `Python 3.12, DuckDB, Drain3` (Hexagonal Ports/Adapters)

## Technical Architecture
- **Frontend**: Tauri v2, React 19, Vite, Zustand, TanStack Table
- **Backend (Python Sidecar)**: Python 3.12, DuckDB, Drain3
- **Communication Protocol**: JSON-RPC 2.0 over stdin/stdout

## Core Features
### 1. High Velocity Ingestion & Clustering
- Sidecar processes raw logs locally, parsing logs using predefined/adaptive regex.
- Applies Drain3 algorithm (log clustering) to extract templates and variables in real-time.

### 2. DuckDB State Management
- DuckDB acts as the persistent store and local analytical engine for the Logs.
- Schema organized to support O(log n) lookups to scale for 1M+ rows.
- The Python sidecar handles all DuckDB access and serves queries to the frontend.

### 3. Deep Dive & Overview Views
- **Overview Dashboard**: High-level statistical breakdown, cluster health, and anomalies overview.
- **Deep Dive View**: Infinite scrolling, highly virtualized log table powered by TanStack Table, allowing sorting, filtering, and rapid search.

## UI / Atomic Design Breakdown
- **Atoms**: LogBadge, FilterInput, StatusDot
- **Molecules**: SearchBar, LogEntryRow, MetricCard
- **Organisms**: VirtualizedLogTable, ClusterTreeMap
- **Templates**: DashboardLayout, InspectorLayout
- **Pages**: OverviewDashboard, DeepDiveView

## 100% Vibecoding & Development Strategy
- **Agents**: Automated subagents (`lint-agent`, `reviewer-agent`, `doc-agent`) will seamlessly check the codebase in the background.
- **Workflow**: Employs `/jules-loop` to shift directly from specification to automated test to implementation via BDD/TDD integration.
