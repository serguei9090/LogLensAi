# Settings Utils

## Overview
Metadata descriptors and serialization parsers for AI provider labels and converting stringified sidecar settings records (including legacy Python `repr` strings) into typed `AppSettings`.

## Interface
- `[providerMetadata.ts:OPENROUTER_FREE_MODELS]` - Exported `as const` readonly tuple of 7 OpenRouter free model descriptors (`id`, `label`, `desc`).
- `[providerMetadata.ts:getProviderLabel]` - Exported function `(provider: string) => string` mapping provider identifiers to display labels.
- `[providerMetadata.ts:getProviderDescription]` - Exported function `(provider: string) => string` mapping provider identifiers to UI descriptions.
- `[settingsSerialization.ts:safeParse]` - Exported function `(raw: string | null) => unknown` parsing JSON strings with a Python `repr` fallback (`'`, `True`, `False`, `None`).
- `[settingsSerialization.ts:parseRemote]` - Exported function `(remoteSettings: Record<string, string>, prev: AppSettings) => AppSettings` hydrating remote key-value settings over existing client defaults.

## Invariants
- `[providerMetadata.ts:OPENROUTER_FREE_MODELS]` Declared `as const` for compile-time readonly tuple guarantees.
- `[providerMetadata.ts:getProviderLabel]` Maps `'openai'`, `'openrouter'`, `'ollama'`, `'ai-studio'`, and `'lmstudio'`, falling back to `'Universal API'` for unrecognized providers.
- `[providerMetadata.ts:getProviderDescription]` Maps the five known providers, falling back to `'Supports Azure, Groq, Perplexity, or any OpenAI-compatible proxy.'` for unrecognized providers.
- `[settingsSerialization.ts:safeParse]` Returns `null` when `raw` is falsy or when both `JSON.parse` and the Python `repr` normalization fallback fail.
- `[settingsSerialization.ts:parseRemote]` Applies default string fallbacks prior to numeric parsing (`drain_similarity_threshold`: `'0.4'`, `drain_max_children`: `'100'`, `drain_max_clusters`: `'1000'`, `ingestion_syslog_port`: `'514'`, `ingestion_http_port`: `'5002'`).
- `[settingsSerialization.ts:parseRemote]` Evaluates `mcp_server_enabled` as true only when `toLowerCase() === 'true'`, whereas `ai_tool_search`, `ai_tool_memory`, `ingestion_syslog_enabled`, and `ingestion_http_enabled` evaluate to true unless `toLowerCase() === 'false'`.
- `[settingsSerialization.ts:parseRemote]` Falls back `drain_masks` to `defaultSettings.drain_masks` when parsed output is not a non-empty array after filtering entries with empty trimmed `label` and `pattern`, and defaults `facet_extractions` to `[]` after the analogous empty-entry filter.
- `[settingsSerialization.ts:parseRemote]` Resolves `ui_command_palette_shortcut` in priority order: falsy raw -> default shortcut, parsed object with `'key'` -> `KeyboardShortcut`, single-character string -> `{ key: raw, ctrl: true }`, otherwise default shortcut.

## Side Effects
- `[settingsSerialization.ts:safeParse]` Logs `console.debug("safeParse: Failed to parse Python repr fallback:", err)` if the Python `repr` fallback fails to parse.

## Verification
- Run: `bun test`
