# A2UI Utils

## Overview
Pure markup parsing utilities that translate `[[A2UI]]...[[/A2UI]]` model output blocks into typed `A2UIComponent` trees.

## Interface
- `[markupParser.ts:parseA2UIMarkup]` — Parses raw `[[A2UI]]` markup strings into an `A2UIComponent` (single component or `{ type: "surface", children }`) or `null`.

## Invariants
- `[markupParser.ts:parseA2UIMarkup]` Strips `[[A2UI]]` and `[[/A2UI]]` tokens and trims whitespace; returns `null` when the cleaned input is empty.
- `[markupParser.ts:parseA2UIMarkup]` Multi-tag matching recognizes only `metric`, `button`, `text`, `chart_area`, and `data_table` tags without nested `[`, `]`, `\n`, or `\r`; returns the component directly for 1 match, wraps `> 1` components in a `surface`, and falls back to `parseSingleTag(clean)` otherwise.
- `[markupParser.ts:parseSingleTag]` Enforces required attributes per tag (`button`: `label`; `text`: `value`; `metric`: `label` + `query`; `chart_area`: `title` + `query`; `data_table`: `title` + `query`), returning `null` if unrecognized or missing required attributes.
- `[markupParser.ts:parseSingleTag]` Parses `action={...}` via `JSON.parse` (leaving `action` undefined on failure) and parses `source_id`/`source_ids` by splitting on `,`, stripping quotes, trimming, and dropping empty strings.

## Side Effects
- `[markupParser.ts:parseSingleTag]` Emits `console.warn("Failed to parse action JSON in A2UI markup:", e)` if JSON parsing fails on a `button` tag's `action` attribute.

## Verification
- Run: `bun test`
