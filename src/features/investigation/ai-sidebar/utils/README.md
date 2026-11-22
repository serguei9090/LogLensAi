# AI Sidebar Utils

## Overview
Pure frontend presets and stream-safe text parsing helpers for the AI investigation sidebar.

## Interface
- `[models.ts:OPENROUTER_QUICK_FREE_MODELS]` — Exported readonly tuple (`as const`) of 6 OpenRouter free-tier `{ id, label }` presets.
- `[models.ts:AI_COMMANDS]` — Exported readonly tuple (`as const`) of 7 slash-command descriptors (`{ cmd, label, desc }`).
- `[parseThinking.ts:CHANNEL_TAGS]` — Exported readonly tuple (`as const`) of 8 raw channel marker strings.
- `[parseThinking.ts:stripChannelTags]` — Removes all `CHANNEL_TAGS` occurrences from text.
- `[parseThinking.ts:A2UI_REGEX]` — Global/dotall `RegExp` matching closed or unclosed `[[A2UI]]` blocks.
- `[parseThinking.ts:stripA2UITags]` — Strips `A2UI_REGEX` matches and trims whitespace.
- `[parseThinking.ts:findFirstTagIndex]` — Returns `{ index, length }` for the earliest matching tag at or after `startSearchFrom`, or `{ index: -1, length: 0 }`.
- `[parseThinking.ts:parseThinking]` — Separates streaming or completed reasoning blocks from sanitized response text.

## Invariants
- `[models.ts:OPENROUTER_QUICK_FREE_MODELS]` Declared `as const`, preserving compile-time readonly tuple and literal types.
- `[models.ts:AI_COMMANDS]` Declared `as const`, enumerating `/search`, `/save`, `/query`, `/analyze`, `/anomalies`, `/create_column`, and `/create_facet`.
- `[parseThinking.ts:A2UI_REGEX]` Uses `gs` flags so both complete `[[A2UI]]...[[/A2UI]]` and unclosed trailing `[[A2UI]]...$` blocks are matched across newlines.
- `[parseThinking.ts:parseThinking]` Falsy input returns `{ thinking: null, response: "", isStreamingThink: false }`.
- `[parseThinking.ts:parseThinking]` Searches for end tags starting at `firstStartIdx + startTagLength` when a start tag matches; collapses whitespace-only `thinking` to `null` in terminal phase (`firstEndIdx !== -1`) and sets `isStreamingThink: true` when a start tag has no closing tag yet.

## Side Effects
- None

## Verification
- Run: `bun test`
