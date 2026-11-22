# Custom Parser

## Overview
Interactive custom log parser modal package enabling users to highlight sample log lines to map timestamp and level offsets, synthesize Python-style named-group regexes, preview live extractions, and persist `ParserConfig` JSON.

## Interface
- `[types.ts:ParserMapping]` — Interface `{ start: number; end: number }` defining character offset ranges.
- `[types.ts:ParserConfig]` — Interface `{ regex: string; mapping: { timestamp?: ParserMapping; level?: ParserMapping } }`.
- `[types.ts:ActiveSelection]` — Interface `{ start: number; end: number; text: string; rect: DOMRect }`.
- `[types.ts:CustomParserModalProps]` — Readonly props interface for `CustomParserModal` (`workspaceId`, `sourceId`, `isOpen`, `onClose`, `onSaved`, `initialConfig?`).
- `[index.ts]` — Barrel re-exports `CustomParserModal`, all types from `./types`, and all utilities from `./utils`.
- `[CustomParserModal.tsx:CustomParserModal]` — Top-level modal orchestrating sample loading, text selection capture, regex synthesis, preview evaluation, and save/clear actions.
- `[ExtractionPanel.tsx:ExtractionPanel]` — Renders the regex textarea, selection mapping triggers, preview list, and Clear/Save actions.
- `[ParserHeader.tsx:ParserHeader]` — Renders modal header, timestamp mapping sync status badge, and close button.
- `[SampleViewer.tsx:SampleViewer]` — Renders numbered sample log lines with highlighted timestamp/level segments.
- `[SelectionToolbar.tsx:SelectionToolbar]` — Renders floating fixed-position toolbar above active text selections to map Timestamp or Level.
- `[utils.ts:generateRegexFromMapping]` — Generates a `^...(?P<key>.{len}).*` regex from `timestamp` and `level` offset mappings.
- `[utils.ts:computePreviewResults]` — Translates Python `(?P<name>...)` groups to JS `RegExp` groups and evaluates sample lines.
- `[utils.ts:HighlightSegment]` — Interface `{ text: string; type?: "timestamp" | "level" }`.
- `[utils.ts:splitLineIntoSegments]` — Splits a log line sequentially into ordered `HighlightSegment` chunks.

## Invariants
- `[types.ts:ParserConfig]` Only optional `timestamp` and `level` `ParserMapping` keys are supported in `mapping`.
- `[CustomParserModal.tsx:CustomParserModal]` Returns `null` and skips sidecar sample fetching when `isOpen` is `false`; resets to empty pattern/mapping when `initialConfig` is absent and ignores invalid `initialConfig` JSON; `handleMouseUp` accepts selections only when trimmed text is non-empty, inside `[data-sample-line="true"]` within `sampleContainerRef.current`, and `rect.width > 0`; `handleSave` serializes `{ regex: regexPattern, mapping }` via `JSON.stringify`.
- `[SampleViewer.tsx:SampleViewer]` Marks each sample line container with `data-sample-line="true"` for selection boundary validation.
- `[ParserHeader.tsx:ParserHeader]` Renders `"Sync Active"` when `hasTimestampMapping` is `true` and `"Unmapped"` otherwise.
- `[ExtractionPanel.tsx:ExtractionPanel]` Displays at most 5 `previewResults` entries and applies error styling strictly when `res.level === "ERROR"`.
- `[SelectionToolbar.tsx:SelectionToolbar]` Positions toolbar at `(rect.top - 48, rect.left + rect.width / 2)` with `translateX(-50%)`.
- `[utils.ts:generateRegexFromMapping]` Returns `""` if neither `timestamp` nor `level` is mapped; sorts mappings ascending by `start`, inserts `.{gap}`, wraps each group as `(?P<key>.{end - start})`, and anchors with `^` and trailing `.*`.
- `[utils.ts:computePreviewResults]` Returns `[]` when `regexPattern` is empty or invalid; translates non-nested `(?P<name>...)` groups to positional groups; falls back to `{ timestamp: "No match", level: "---" }` on non-matches and `match[0].substring(0, 20)` / `"INFO"` when fields are omitted.

## Side Effects
- `[CustomParserModal.tsx:CustomParserModal]` Calls sidecar RPC `"get_sample_lines"` (`limit: 15`) via `callSidecar` when opened; attaches/removes `"mouseup"` listener on `sampleContainerRef.current`; reads `globalThis.getSelection()`; emits `sonner` toasts, `console.warn`, and `console.error`; invokes `onSaved` and `onClose`.
- `[utils.ts:computePreviewResults]` Logs regex compilation/evaluation failures via `console.error`.
- `[ExtractionPanel.tsx:ExtractionPanel]`, `[ParserHeader.tsx:ParserHeader]`, `[SelectionToolbar.tsx:SelectionToolbar]` Dispatch parent interaction callbacks on user actions.

## Verification
- Run: `bun test`
