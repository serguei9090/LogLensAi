# AI Sidebar Utils

## Overview
Pure utility definitions and streaming parser helpers for the AI investigation sidebar, supplying quick-select OpenRouter free model presets, slash command metadata, and incremental `<thought>`/`<|channel|>`/`[[A2UI]]` tag separation.

## Interface
- `[models.ts:OPENROUTER_QUICK_FREE_MODELS]` - Exported `as const` tuple of 6 `{ id, label }` quick-select OpenRouter free model entries.
- `[models.ts:AI_COMMANDS]` - Exported `as const` tuple of 7 `{ cmd, label, desc }` slash command definitions.
- `[parseThinking.ts:CHANNEL_TAGS]` - Exported `as const` tuple of 8 channel/thought/text delimiter tokens stripped from responses.
- `[parseThinking.ts:stripChannelTags]` - Exported function `(text: string) => string` removing all `CHANNEL_TAGS` tokens.
- `[parseThinking.ts:A2UI_REGEX]` - Exported regex `/\[\[A2UI\]\].*?(\[\[\/A2UI\]\]|$)/gs` matching complete or unclosed streaming `[[A2UI]]` blocks.
- `[parseThinking.ts:stripA2UITags]` - Exported function `(text: string) => string` removing all matches of `A2UI_REGEX` and trimming.
- `[parseThinking.ts:findFirstTagIndex]` - Exported function `(content: string, tags: readonly string[], startSearchFrom?: number) => { index: number; length: number }` finding the earliest tag match.
- `[parseThinking.ts:parseThinking]` - Exported function `(content: string) => { thinking: string | null; response: string; isStreamingThink: boolean }` splitting model reasoning from user-facing output.

## Invariants
- `[models.ts:OPENROUTER_QUICK_FREE_MODELS]` Defined as a compile-time `readonly` literal tuple via `as const` (no runtime `Object.freeze`).
- `[models.ts:AI_COMMANDS]` Defined as a compile-time `readonly` literal tuple via `as const`.
- `[parseThinking.ts:A2UI_REGEX]` Uses `/gs` (global + dotAll) flags required by `stripA2UITags` (`replaceAll`) and multiline/unclosed block matching.
- `[parseThinking.ts:findFirstTagIndex]` Scans from `startSearchFrom` (default `0`) and selects the match with strictly smallest index (`idx < firstIdx`, tie-breaking by array order), returning `{ index: -1, length: 0 }` when unmatched.
- `[parseThinking.ts:parseThinking]` Returns `{ thinking: null, response: "", isStreamingThink: false }` immediately for falsy `content`.
- `[parseThinking.ts:parseThinking]` Searches for end tags starting at `firstStartIdx === -1 ? 0 : firstStartIdx + startTagLength`, ensuring `firstEndIdx` cannot precede the matched start tag.
- `[parseThinking.ts:parseThinking]` Terminal state (`firstEndIdx !== -1`) sets `isStreamingThink: false`, strips `CHANNEL_TAGS` and start/end tags, collapses whitespace-only thinking to `null`, and runs `stripA2UITags` on trimmed `response`; active streaming state (`firstEndIdx === -1 && firstStartIdx !== -1`) sets `isStreamingThink: true` and keeps un-trimmed stripped `thinking`; fallback state returns `thinking: null` and `stripA2UITags(stripChannelTags(content))`.

## Side Effects
- `None`

## Verification
- Run: `bun test`
