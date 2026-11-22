# Settings Utils

## Overview
Pure settings utilities providing static LLM provider metadata/labels and tolerant deserialization of flat sidecar string settings into typed `AppSettings`.

## Interface
- `[providerMetadata.ts:OPENROUTER_FREE_MODELS]` — Exported readonly array (`as const`) of 7 OpenRouter free model descriptors (`id`, `label`, `desc`).
- `[providerMetadata.ts:getProviderLabel]` — Maps provider IDs (`openai`, `openrouter`, `ollama`, `ai-studio`, `lmstudio`) to display labels with `"Universal API"` fallback.
- `[providerMetadata.ts:getProviderDescription]` — Maps provider IDs to configuration hint text with an OpenAI-compatible proxy fallback.
- `[settingsSerialization.ts:safeParse]` — Parses JSON strings with a Python repr normalization fallback (`'`, `True`, `False`, `None`), returning `null` on failure.
- `[settingsSerialization.ts:parseRemote]` — Maps a flat `Record<string, string>` from the sidecar onto a shallow copy of `prev: AppSettings` with defaults and schema sanitization.

## Invariants
- `[providerMetadata.ts:OPENROUTER_FREE_MODELS]` Declared `as const`, preserving readonly tuple and literal types across all 7 entries.
- `[providerMetadata.ts:getProviderLabel]` & `[providerMetadata.ts:getProviderDescription]` Always return non-empty fallback strings for unknown provider IDs.
- `[settingsSerialization.ts:safeParse]` Returns `null` for falsy input or when both `JSON.parse` and Python repr replacement parsing fail; never throws.
- `[settingsSerialization.ts:parseRemote]` Returns a shallow copy without mutating `prev`; substitutes default numeric strings (`"0.4"`, `"100"`, `"1000"`, `"514"`, `"5002"`) when missing/empty; treats `mcp_server_enabled` as opt-in (`"true"`) while `ai_tool_search`, `ai_tool_memory`, `ingestion_syslog_enabled`, and `ingestion_http_enabled` are opt-out (`!== "false"`); falls back `drain_masks` to `defaultSettings.drain_masks` if non-array or empty after blank-entry filtering; filters blank `facet_extractions`; normalizes `ui_command_palette_shortcut` objects or single-char strings to `{ key, ctrl: true }`.

## Side Effects
- `[settingsSerialization.ts:safeParse]` Logs `console.debug("safeParse: Failed to parse Python repr fallback:", err)` if the Python repr fallback parse throws.

## Verification
- Run: `bun test`
