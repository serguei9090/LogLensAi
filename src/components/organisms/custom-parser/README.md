# Custom Parser

## Overview
Interactive regex-builder modal for mapping log timestamp and severity level spans directly from sampled log lines, validating extracted captures against live samples, and persisting parser configuration JSON.

## Interface
- `[index.ts:CustomParserModal]` - Re-exports `CustomParserModal` from `./CustomParserModal`.
- `[index.ts:ParserMapping]` - Re-exports `ParserMapping` from `./types`.
- `[index.ts:ParserConfig]` - Re-exports `ParserConfig` from `./types`.
- `[index.ts:ActiveSelection]` - Re-exports `ActiveSelection` from `./types`.
- `[index.ts:CustomParserModalProps]` - Re-exports `CustomParserModalProps` from `./types`.
- `[index.ts:generateRegexFromMapping]` - Re-exports `generateRegexFromMapping` from `./utils`.
- `[index.ts:computePreviewResults]` - Re-exports `computePreviewResults` from `./utils`.
- `[index.ts:HighlightSegment]` - Re-exports `HighlightSegment` from `./utils`.
- `[index.ts:splitLineIntoSegments]` - Re-exports `splitLineIntoSegments` from `./utils`.
- `[types.ts:ParserMapping]` - Exported interface `{ start: number; end: number }`.
- `[types.ts:ParserConfig]` - Exported interface `{ regex: string; mapping: { timestamp?: ParserMapping; level?: ParserMapping } }`.
- `[types.ts:ActiveSelection]` - Exported interface `{ start: number; end: number; text: string; rect: DOMRect }`.
- `[types.ts:CustomParserModalProps]` - Exported interface with readonly props `workspaceId`, `sourceId`, `isOpen`, `onClose`, `onSaved`, and optional `initialConfig`.
- `[CustomParserModal.tsx:CustomParserModal]` - Exported React component orchestrating sample fetching, text selection capture, regex synthesis, preview computation, and save handling.
- `[ExtractionPanel.tsx:ExtractionPanel]` - Exported React component rendering the regex editor, mapping actions, and live extraction preview list.
- `[ParserHeader.tsx:ParserHeader]` - Exported React component rendering the modal header, timestamp mapping badge, and close button.
- `[SampleViewer.tsx:SampleViewer]` - Exported React component rendering sampled log lines with highlighted mapped segments.
- `[SelectionToolbar.tsx:SelectionToolbar]` - Exported React component rendering the floating selection tooltip for mapping timestamp or severity spans.
- `[utils.ts:generateRegexFromMapping]` - Exported function synthesizing a named-group Python/Go-style `(?P<key>.{len})` regex from span mappings.
- `[utils.ts:computePreviewResults]` - Exported function compiling `(?P<name>...)` patterns into JS positional groups and extracting preview `timestamp`/`level` results per sample line.
- `[utils.ts:HighlightSegment]` - Exported interface `{ text: string; type?: "timestamp" | "level" }`.
- `[utils.ts:splitLineIntoSegments]` - Exported function partitioning a sample line into highlighted and plain segments.

## Invariants
- `[types.ts:CustomParserModalProps]` All properties on `CustomParserModalProps` are `readonly`.
- `[CustomParserModal.tsx:CustomParserModal]` Sample-fetching `useEffect` and component render both return early when `!isOpen`.
- `[CustomParserModal.tsx:CustomParserModal]` When `initialConfig` is truthy, parses JSON into `regexPattern` and `mapping`; when falsy, resets `regexPattern` to `""` and `mapping` to `{}`.
- `[CustomParserModal.tsx:CustomParserModal]` `handleMouseUp` sets `activeSelection` only when a non-empty selection lies inside an element with `dataset.sampleLine === "true"` and `range.getBoundingClientRect().width > 0`; otherwise clears `activeSelection` to `null`.
- `[CustomParserModal.tsx:CustomParserModal]` Syncs `regexPattern` from `mapping` only when `generateRegexFromMapping(mapping)` returns a non-empty string; `handleMapTimestamp` and `handleMapLevel` abort if `!activeSelection`; `handleSave` emits `JSON.stringify({ regex: regexPattern, mapping })` via `onSaved` and invokes `onClose()`.
- `[utils.ts:generateRegexFromMapping]` Returns `""` if neither `timestamp` nor `level` is mapped; sorts defined ranges ascending by `start`, inserts `.{n}` gaps, emits `(?P<key>.{len})`, and anchors with `^...*`.
- `[utils.ts:computePreviewResults]` Returns `[]` when `!regexPattern` or on `RegExp` compilation/execution error; rewrites `(?P<name>...)` to positional `(...)` captures, emits `{ timestamp: "No match", level: "---" }` for non-matching lines, and falls back to `match[0].substring(0, 20)` for timestamp and `"INFO"` for level.
- `[utils.ts:splitLineIntoSegments]` Sorts defined ranges ascending by `start`, emits plain gap segments, emits typed `"timestamp"`/`"level"` segments for `[start, end)`, and appends remaining trailing text.
- `[SampleViewer.tsx:SampleViewer]` Renders rows only when `!isLoading && samples.length > 0`, tagging each row with `data-sample-line="true"`.
- `[ExtractionPanel.tsx:ExtractionPanel]` Caps rendered preview items to `previewResults.slice(0, 5)`, shows inline mapping controls only when `activeSelection` is truthy, and applies error badge styling strictly for `res.level === "ERROR"`.
- `[ParserHeader.tsx:ParserHeader]` Displays `"Sync Active"` when `hasTimestampMapping` is true and `"Unmapped"` otherwise.
- `[SelectionToolbar.tsx:SelectionToolbar]` Fixed-positions tooltip at `top: (selection.rect?.top || 0) - 48`, `left: (selection.rect?.left || 0) + (selection.rect?.width || 0) / 2`, `transform: "translateX(-50%)"`.

## Side Effects
- `[CustomParserModal.tsx:CustomParserModal]` Calls `callSidecar<string[]>({ method: "get_sample_lines", params: { workspace_id: workspaceId, source_id: sourceId, limit: 15 } })` when `isOpen` is true, registers/removes a `"mouseup"` listener on `sampleContainerRef.current`, reads `globalThis.getSelection()` and `range.getBoundingClientRect()`, mutates component state, shows `toast.error`/`toast.success`, logs `console.warn`/`console.error`, and invokes `onSaved`/`onClose`.
- `[utils.ts:computePreviewResults]` Logs `console.error("Regex preview generation failed", _error)` on `RegExp` errors.
- `[ExtractionPanel.tsx:ExtractionPanel]` Invokes `setRegexPattern`, `onMapTimestamp`, `onMapLevel`, `onClear`, and `onSave`.
- `[ParserHeader.tsx:ParserHeader]` Invokes `onClose`.
- `[SelectionToolbar.tsx:SelectionToolbar]` Invokes `onMapTimestamp` and `onMapLevel`.
- `[SampleViewer.tsx:SampleViewer]` Attaches `containerRef` to the sample container `<section>`.

## Verification
- Run: `bun test`
