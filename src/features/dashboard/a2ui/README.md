# A2UI

## Overview
A2UI runtime package providing the shared blueprint schema, public barrel exports, and recursive `A2UIRenderer` that renders JSON component trees or `[[A2UI]]` markup wrappers into live-queried log visualization cards and layout primitives.

## Interface
- `[types.ts:A2UIComponent]` — Node schema (`type`, optional `text`, `label`, `children`, `props`, and `action`).
- `[types.ts:A2UIRendererProps]` — Props interface `{ payload: unknown; onAction?: (action: unknown) => void }`.
- `[A2UIRenderer.tsx:A2UIRenderer]` — `React.FC<A2UIRendererProps>` rendering `A2UIComponent` trees and `{ type: "markup", raw }` payloads.
- `[index.ts]` — Re-exports `A2UIRenderer`, `A2UIMetricCard`, `A2UIChartArea`, `A2UILogTable`, `type A2UIComponent`, and `type A2UIRendererProps`.
- Subdirectories:
  - [components](./components/README.md) — Live sidecar-backed A2UI visualization cards (`A2UIChartArea`, `A2UILogTable`, `A2UIMetricCard`).
  - [utils](./utils/README.md) — `[[A2UI]]` markup parser (`parseA2UIMarkup`).

## Invariants
- `[A2UIRenderer.tsx:A2UIRenderer]` Returns `null` immediately if `payload` is falsy or `typeof payload !== "object"`.
- `[A2UIRenderer.tsx:A2UIRenderer]` When `payload` is `{ type: "markup", raw: string }`, invokes `parseA2UIMarkup` and renders `"[Malformed A2UI Blueprint]"` when parsing returns `null`.
- `[A2UIRenderer.tsx:A2UIRenderer]` Dispatches strictly on `comp.type` (`"text"`, `"button"`, `"metric"`, `"chart_area"`, `"data_table"`, `"card"`, `"stack_v"`, `"stack_h"`, `"surface"`, `"root"`), returning `null` for unknown types; defaults labels to `"Metric"`, `"Traffic History"`, and `"Data Table"`, defaults `props.query` to `""`, sets button `aria-label` to `"Action: <label>"` or `"Interactive Action"`, and recurses into `comp.children` only for container types (`"card"`, `"stack_v"`, `"stack_h"`, `"surface"`, `"root"`).

## Side Effects
- None (delegates live sidecar polling to `./components/README.md`)

## Verification
- Run: `bun test`
