# LogLensAi - Function & Component Index

This file provides a comprehensive list of all core logic functions in the backend sidecar and functional components in the React frontend. It serves as a quick reference for logic discovery and architectural navigation.

## 🐍 Backend (Python Sidecar)

| Function | Summary | File |
|---|---|---|
| `App.dispatch` | Route incoming JSON-RPC requests to the appropriate method handler. | `sidecar/src/api.py` |
| `App.method_get_logs` | Fetch logs normally for a workspace/source. | `sidecar/src/api.py` |
| `App.method_get_fused_logs` | Fetch interleaved logs for Fusion mode with Timezone normalization. | `sidecar/src/api.py` |
| `App.method_ingest_logs` | Manually ingest raw log entries into a specific workspace. | `sidecar/src/api.py` |
| `App.method_start_tail` | Initialize a local file tailing session. | `sidecar/src/api.py` |
| `App.method_start_ssh_tail` | Initialize a remote SSH tailing session. | `sidecar/src/api.py` |
| `App.method_analyze_cluster` | Trigger an AI-driven root cause analysis for a log cluster. | `sidecar/src/api.py` |
| `Database.get_cursor` | Thread-safe entry point for DuckDB database operations. | `sidecar/src/db.py` |
| `DrainParser.match` | Mine log templates and variables using the Drain3 engine. | `sidecar/src/parser.py` |
| `extract_log_metadata` | Heuristic based metadata extraction (IPs, UUIDs) from raw logs. | `sidecar/src/metadata_extractor.py` |
| `FileTailer.start` | Background thread execution for real-time local file monitoring. | `sidecar/src/tailer.py` |
| `SSHLoader.start_remote_tail` | Background thread execution for paramiko-based remote monitoring. | `sidecar/src/ssh_loader.py` |
| `AIProviderFactory.get_provider` | Factory for instantiating AI strategies (Gemini, Ollama, AI Studio). | `sidecar/src/ai/__init__.py` |

## ⚛️ Frontend (React/TypeScript)

| Component / Hook | Summary | File |
|---|---|---|
| `useSidecarBridge` | Main bridge for non-blocking RPC communication with the sidecar. | `src/lib/hooks/useSidecarBridge.ts` |
| `useLogStream` | React hook for managing real-time tailing subscriptions. | `src/lib/hooks/useLogStream.ts` |
| `VirtualLogTable` | High-performance virtualized log list rendering. | `src/components/organisms/VirtualLogTable.tsx` |
| `AIInvestigationSidebar` | Context-aware AI chat and diagnostic pane. | `src/components/organisms/AIInvestigationSidebar.tsx` |
| `OrchestratorHub` | Control center for Fusion strategies and source alignment. | `src/components/organisms/OrchestratorHub.tsx` |
| `WorkspaceEngineSettings` | Low-level Drain3 and Masking configuration overrides. | `src/components/organisms/WorkspaceEngineSettings.tsx` |
| `A2UIRenderer` | Adaptive generator for AI-emitted UI widgets (A2UI v0.9). | `src/components/atoms/A2UIRenderer.tsx` |
| `TimeRangePicker` | Professional temporal filter widget for global log scoping. | `src/components/molecules/TimeRangePicker.tsx` |
| `useWorkspaceStore` | Zustand store for workspace state and source orchestration. | `src/store/workspaceStore.ts` |
| `useInvestigationStore` | Zustand store for active view state, filters, and selections. | `src/store/investigationStore.ts` |
| `useAiStore` | Zustand store for AI session history and streaming state. | `src/store/aiStore.ts` |

---
*Generated automatically by Antigravity on 2026-04-19.*
