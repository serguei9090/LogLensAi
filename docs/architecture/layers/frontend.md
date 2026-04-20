# Frontend Architecture (layers/frontend.md)

This document describes the React 19 frontend, its atomic component structure, state management using Zustand, and key hooks.

## 👤 Persona: `@frontend-arch`
Expert in responsive UI, state synchronization, and large-scale data virtualization. Focuses on the "Desktop Shell" (React 19 + Tauri v2).

## ⚛️ Component Hierarchy (Atomic Design)

| Layer | Folder | Responsibility | Example Components |
|---|---|---|---|
| **Atoms** | `src/components/atoms/` | Smallest functional units. Single purpose. | `LogLevelBadge`, `StatusDot`, `TailSwitch`, `HelpTooltip`, `IconButton`. |
| **Molecules** | `src/components/molecules/` | Groups of atoms functioning together. | `SearchBar`, `FilterTag`, `HighlightTag`, `FilterBuilder`, `HighlightBuilder`. |
| **Organisms** | `src/components/organisms/` | Complex, data-aware UI sections. | `LogToolbar`, `VirtualLogTable`, `ImportFeedModal`, `Sidebar`, `SettingsPanel`. |
| **Templates** | `src/components/templates/` | Page-level layouts focusing on structure. | `AppLayout` (Sidebar + Content), `InvestigationLayout` (Toolbar + Table). |
| **Pages** | `src/components/pages/` | Assembled views with real data/state. | `InvestigationPage`, `SettingsPage`, `DashboardPage` (Placeholder). |

## 🧠 State Management (Zustand)

### `useInvestigationStore` (investigationStore.ts)
The central brain for log analysis. Manages search, filters, highlights, and temporal bounds.

| State Key | Type | Description |
|---|---|---|
| `searchQuery` | `string` | Debounced text to find within `message` or `raw_text`. |
| `filters` | `FilterEntry[]` | Structured SQL-style filters (equals, contains, regex). |
| `facetFilters` | `Record<string, string[]>` | Dynamic categorical filters for extracted metadata (IPs, UUIDs). |
| `highlights` | `HighlightEntry[]` | Visual-only term coloring rules (no backend filtering). |
| `logs` | `LogEntry[]` | Current paginated buffer of logs to be displayed. |
| `timeRange` | `{ start, end }` | ISO strings for global temporal filtering. |
| `currentSourceId`| `string` | The active filter context (a specific file path or "aggregate"). |
| `sourceStates` | `Record<string, Snapshot>`| Deep-cached state for every source seen in a session. |

### `useWorkspaceStore` (workspaceStore.ts)
Manages the list of active LogLens workspaces.
- Handles creation, deletion, and selection of workspace contexts.
- Synchronizes with Tauri FS to persist workspace metadata.

## 🛠️ Custom Hooks (lib/hooks/)

### `useSidecarBridge`
- **Purpose**: Proxies React calls to the Python `stdin/stdout` bridge.
- **Contract**: Ensures all `callSidecar` calls are wrapped in standard error handling and type-safe response parsing.
- **Key Methods**: `get_logs`, `export_logs`, `get_settings`, `update_settings`, `ingest_logs`, `get_metadata_facets`.

### `useLogStream` (Future/TBD)
- **Purpose**: Handles the reactive update loop for live tailing (polling or WebSocket/EventSource bridge).

## 📊 Virtualization Engine
Powered by `@tanstack/react-virtual`, the `VirtualLogTable` renders only the visible subset of logs within its viewport. This allows LogLensAi to handle 100k+ logs in memory without meaningful frame drops.

## 🎨 Styling Architecture
- **Tailwind CSS**: Utility-first styling with absolute token usage from `globals.css`.
- **Shadcn/UI**: Low-level high-quality primitives (Radix UI or Base UI).
- **Hard Rule**: No hardcoded hex colors. Use CSS custom properties (`var(--primary-green)`) to ensure dark-mode consistency.
