# A2UI Utils

## Overview
Pure parsing utilities for converting inline `[[A2UI]]` declarative widget markup blocks from AI responses into typed `A2UIComponent` AST trees.

## Interface
- `[markupParser.ts:parseA2UIMarkup]` - Exported function `(raw: string) => A2UIComponent | null` that strips `[[A2UI]]`/`[[/A2UI]]` tokens and parses `metric`, `button`, `text`, `chart_area`, and `data_table` tag statements into a single `A2UIComponent`, a `"surface"` container of children, or `null`.

## Invariants
- `[markupParser.ts:parseA2UIMarkup]` Strips all `"[[A2UI]]"` and `"[[/A2UI]]"` markers and trims whitespace, returning `null` if empty.
- `[markupParser.ts:parseA2UIMarkup]` Matches tags with keyword `(metric|button|text|chart_area|data_table)` followed by whitespace and non-bracket/non-newline content; returns `components[0]` for a single match, `{ type: "surface", children: components }` for multiple matches, or falls back to `parseSingleTag(clean)` when zero regex/valid components match.
- `[markupParser.ts:parseSingleTag]` Returns `null` when the statement is empty, lacks a valid tag prefix, or omits required attributes (`button`: `label`; `text`: `value`; `metric`: `label` and `query`; `chart_area`: `title` and `query`; `data_table`: `title` and `query`).
- `[markupParser.ts:parseSingleTag]` Parses button `action={...}` payloads up to the first `}` via `JSON.parse` inside a `try/catch`, leaving `action` undefined rather than throwing on invalid JSON.
- `[markupParser.ts:parseSingleTag]` Splits optional `source_id`/`source_ids` attributes for `metric`, `chart_area`, and `data_table` on `","`, strips surrounding single/double quotes, trims entries, and filters empty strings.

## Side Effects
- `[markupParser.ts:parseSingleTag]` Logs `console.warn("Failed to parse action JSON in A2UI markup:", e)` when `JSON.parse` fails on a button `action={...}` attribute.

## Verification
- Run: `bun test`
