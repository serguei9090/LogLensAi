# Settings Sections

## Overview
Domain-specific configuration section forms inside the Settings panel covering AI provider/model/MCP tools, Drain3 clustering and timestamp/facet extraction, Syslog/HTTP ingestion ports, Laya rules embedding, and RAG model download/knowledge-base indexing.

## Interface
- `[AISettingsSection.tsx:AISettingsSection]` - Exported React component rendering AI provider selection, credential/host inputs, model selector, system prompt, and MCP/tool toggles.
- `[DrainSettingsSection.tsx:DrainSettingsSection]` - Exported React component rendering collapsible cards for Drain3 parameters, masking rules, custom timestamp regex/format, and facet extractions.
- `[IngestionSettingsSection.tsx:IngestionSettingsSection]` - Exported React component rendering Syslog and HTTP listener enable switches and port inputs.
- `[LayaSettingsSection.tsx:LayaSettingsSection]` - Exported React component mounting `LayaSettingsPanel` with no props.
- `[RAGSettingsSection.tsx:RAGSettingsSection]` - Exported React component rendering RAG embedder selection (`onnx`/`ollama`), hardware acceleration, model download/status, and knowledge-base folder sync.

## Invariants
- `[AISettingsSection.tsx:AISettingsSection]` `showApiKey` and `isToolsExpanded` default to `false` (tools/Add Skill render only when expanded); switching `#ai_provider` resolves `newModel = providerModelsCache[v]?.[0] || ""` and saves immediately; `"openai"`, `"ai-studio"`, `"openrouter"`, and `"openai-compatible"` require an API key to enable `Test Connection` except `"openai-compatible"`.
- `[DrainSettingsSection.tsx:DrainSettingsSection]` Collapsible states default to `isClusteringOpen = true`, `isTimestampOpen = false`, `isFacetsOpen = false`; numeric inputs parse via `Number.parseFloat` / `Number.parseInt(..., 10)` on change (`update(..., false)`) and save on blur; rendering guards `settings.drain_masks` with `Array.isArray`, while mutation handlers spread `settings.drain_masks` assuming an array.
- `[IngestionSettingsSection.tsx:IngestionSettingsSection]` Syslog/HTTP port inputs parse via `Number.parseInt(e.target.value, 10)` (`update(..., false)` onChange, `onSave` onBlur), while switches call `update(key, checked)` directly.
- `[RAGSettingsSection.tsx:RAGSettingsSection]` Defaults `resolvedDefaultPath` to `"knowledge"`, `activeWorkspaceId` to `"default"` on RPCs, `rag_embedder_type` to `"onnx"`, and `rag_device` to `"cpu"`; uses an active mount guard for `get_rag_model_status`; `handleDownloadModel` polls every `1500` ms until `"ready"`, `"error"`, or `"idle"` (or error); `handleBrowseFolder` branches on `isTauri` (`__TAURI_INTERNALS__`).

## Side Effects
- `[AISettingsSection.tsx:AISettingsSection]` Schedules `setTimeout(() => setSaved(false), 2000)` on provider switch and invokes `setSettings`, `onSave`, `setSaved`, `update`, `handleTestConnection`, `fetchModels`, and `setIsSkillModalOpen`.
- `[DrainSettingsSection.tsx:DrainSettingsSection]` Mutates copied mask entries in `[...settings.drain_masks]` before calling `update("drain_masks", newMasks)` and invokes `onSave`, `handleResetMasks`, and `setIsResetPatternsModalOpen`.
- `[IngestionSettingsSection.tsx:IngestionSettingsSection]` Delegates updates and persistence via `update` and `onSave`.
- `[RAGSettingsSection.tsx:RAGSettingsSection]` Subscribes to `useWorkspaceStore` (`activeWorkspaceId`), invokes RPCs `get_rag_model_status`, `download_rag_model`, and `sync_knowledge_base`, starts a `1500` ms `setInterval` poll on download (not cleared on unmount), dynamically imports `@tauri-apps/plugin-dialog` or clicks an ephemeral `<input type="file" webkitdirectory>`, shows Sonner toasts, logs `console.warn`/`console.error`, and invokes `update`/`onSave`.

## Verification
- Run: `bun test`
