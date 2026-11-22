# Features

## Overview
Domain feature packages for the LogLensAi React frontend, organizing application shell framing, log investigation, analytics dashboard and A2UI insights, Laya System 1 rule management, log fusion orchestration, and settings configuration.

## Subdirectories & Boundaries
- `dashboard`: [./dashboard/README.md](./dashboard/README.md) - Analytics dashboard page, ECharts severity histograms, filter/heatmap widgets, `useDashboardData` hook, `AIInsightsStudio`, and A2UI runtime/cards.
- `investigation`: [./investigation/README.md](./investigation/README.md) - Core log investigation view, virtualized log table, facet/column sidebars, AI investigation sidebar, custom regex parser, multi-tab feed importer, and export/shortcut hooks.
- `laya`: [./laya/README.md](./laya/README.md) - Laya System 1 decision rulebook tabs, JSON editor, checkpoint history/rollback modals, and interactive rule playground.
- `orchestrator`: [./orchestrator/README.md](./orchestrator/README.md) - Slide-over `OrchestratorHub` drawer, multi-source log fusion configuration engine, AI architecture context editor, and temporal offset alignment dialogs.
- `settings`: [./settings/README.md](./settings/README.md) - Application and workspace-override settings panels covering AI providers, Drain3 clustering, network ingestion, Laya AI, and RAG indexing.
- `shell`: [./shell/README.md](./shell/README.md) - 3-column `@dnd-kit` application layout, collapsible workspace sidebar, command palette, cluster diagnostic drawer, sidecar startup health gateway, and debug console.
