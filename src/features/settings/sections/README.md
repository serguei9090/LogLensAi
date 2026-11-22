# Settings Sections

## Overview
Domain-specific React settings section panels covering AI provider/prompt/tool configuration, Drain3 clustering and parsing rules, Syslog/HTTP network ingestion, Laya AI delegation, and local ONNX/Ollama RAG indexing.

## Interface
- `[AISettingsSection.tsx:AISettingsSection]` — Renders AI provider selection, endpoint/credential inputs, connection testing, model selection, prompt/reasoning controls, and tool toggles.
- `[DrainSettingsSection.tsx:DrainSettingsSection]` — Renders Global Core Engine controls for Drain3 similarity/depth/cluster limits, timestamp regex/format, custom facet extraction, and masking patterns.
- `[IngestionSettingsSection.tsx:IngestionSettingsSection]` — Renders Network Ingestion configuration for Syslog UDP and HTTP ingestion listener ports and toggles.
- `[LayaSettingsSection.tsx:LayaSettingsSection]` — Parameterless wrapper rendering the Laya AI section header and delegating body content to `LayaSettingsPanel`.
- `[RAGSettingsSection.tsx:RAGSettingsSection]` — Renders Knowledge Base & Resolution RAG controls for embedder type (`onnx` / `ollama`), hardware acceleration, model weights download, knowledge directory selection, and vector re-indexing.

## Invariants
- `[AISettingsSection.tsx:AISettingsSection]` Switching `ai_provider` resets `ai_model` to `providerModelsCache[v][0] ?? ""` before calling `setSettings`, `onSave`, and `setSaved`; maps provider credentials/hosts strictly per provider (`ollama`, `lmstudio`, `openai`, `ai-studio`, `openrouter`, `openai-compatible`); disables Test Connection when `isTestingConnection` is true or a required API key (all non-local providers except `"openai-compatible"`) is blank.
- `[DrainSettingsSection.tsx:DrainSettingsSection]` Constrains `drain_similarity_threshold` to `[0, 1]` (`Number.parseFloat`), `drain_max_children` and `drain_max_clusters` to `min=1` base-10 integers (`Number.parseInt`), guards `drain_masks` with `Array.isArray`, and defaults `timestamp_custom_regex`/`timestamp_custom_format` to `""` and `facet_extractions` to `[]`.
- `[IngestionSettingsSection.tsx:IngestionSettingsSection]` Parses `ingestion_syslog_port` and `ingestion_http_port` as base-10 integers on change (`saveImmediately=false`) and persists on blur via `onSave(settings)`, while boolean toggles persist immediately.
- `[RAGSettingsSection.tsx:RAGSettingsSection]` Defaults `workspace_id` to `"default"`, defaults nullish `rag_embedder_type` to `"onnx"` (gating `HardwareAcceleration` and `ModelWeightsStatus` to `"onnx"` and `rag_ollama_host` to `"ollama"`), defaults blank `rag_knowledge_path` to `resolvedDefaultPath` (`"knowledge"`), guards mount-time status fetch with an unmount `active` flag, and stops polling on `"ready"`, `"error"`, `"idle"`, or RPC errors.

## Side Effects
- `[AISettingsSection.tsx:AISettingsSection]` Calls `setSettings`, `onSave`, `setSaved(true)`, an uncleaned `2000` ms `setTimeout`, `update`, `handleTestConnection`, `fetchModels`, and `setIsSkillModalOpen(true)`.
- `[DrainSettingsSection.tsx:DrainSettingsSection]` Shallow-copies `settings.drain_masks` (mutating the targeted item on edit) and invokes `update`, `onSave`, `handleResetMasks`, and `setIsResetPatternsModalOpen(true)`.
- `[IngestionSettingsSection.tsx:IngestionSettingsSection]` Invokes `update` and `onSave` on port edits/blurs and listener switches.
- `[RAGSettingsSection.tsx:RAGSettingsSection]` Reads `activeWorkspaceId` from `useWorkspaceStore`; calls sidecar RPCs `get_rag_model_status` (including `1500` ms download polling), `download_rag_model`, and `sync_knowledge_base` via `callSidecar`; opens native folder picker via `@tauri-apps/plugin-dialog` in Tauri (`"__TAURI_INTERNALS__" in globalThis`) or injects/clicks `<input type="file" webkitdirectory directory multiple>` in browser; emits `sonner` toasts, `console.warn`/`console.error`, `update`, and `onSave`.

## Verification
- Run: `bun test`
