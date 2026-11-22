# A2UI Renderer

## Overview
Declarative A2UI surface renderer transforming structured JSON trees or raw `[[A2UI]]` markup strings into interactive metric cards, ECharts distribution charts, log tables, buttons, and layout containers.

## Interface
- `[types.ts:A2UIComponent]` - Exported interface describing a node (`type`, optional `text`, `label`, `children`, `props`, `action`).
- `[types.ts:A2UIRendererProps]` - Exported interface `{ payload: unknown; onAction?: (action: unknown) => void }`.
- `[index.ts:A2UIRenderer]` - Re-exports `A2UIRenderer` from `./A2UIRenderer`.
- `[index.ts:A2UIMetricCard]` - Re-exports `A2UIMetricCard` from `./components/A2UIMetricCard`.
- `[index.ts:A2UIChartArea]` - Re-exports `A2UIChartArea` from `./components/A2UIChartArea`.
- `[index.ts:A2UILogTable]` - Re-exports `A2UILogTable` from `./components/A2UILogTable`.
- `[index.ts:A2UIComponent]` - Re-exports type `A2UIComponent` from `./types`.
- `[index.ts:A2UIRendererProps]` - Re-exports type `A2UIRendererProps` from `./types`.
- `[A2UIRenderer.tsx:A2UIRenderer]` - Exported `React.FC<A2UIRendererProps>` rendering either parsed markup wrappers or typed `A2UIComponent` trees.
- Child contracts: [components](./components/README.md), [utils](./utils/README.md).

## Invariants
- `[types.ts:A2UIComponent]` Every component node requires `type: string`; when present, `action` requires `action.type: string`.
- `[A2UIRenderer.tsx:A2UIRenderer]` Returns `null` when `!payload || typeof payload !== 'object'`.
- `[A2UIRenderer.tsx:A2UIRenderer]` When `payload.type === 'markup'` and `typeof payload.raw === 'string'`, parses via `parseA2UIMarkup(payload.raw)` and renders `"[Malformed A2UI Blueprint]"` if parsing yields null.
- `[A2UIRenderer.tsx:renderComponent]` Recognizes strictly `'text'`, `'button'`, `'metric'`, `'chart_area'`, `'data_table'`, `'card'`, `'stack_v'`, `'stack_h'`, `'surface'`, and `'root'`, returning `null` for unknown node types; applies default titles/queries (`'Metric'`, `'Traffic History'`, `'Data Table'`, `''`) and sets button `aria-label` to `'Action: <label>'` or `'Interactive Action'`.

## Side Effects
- `[A2UIRenderer.tsx:renderComponent]` Invokes `onAction?.(comp.action)` on `'button'` click; child metric/chart/table widgets perform sidecar RPC polling as documented in `./components/README.md`.

## Verification
- Run: `bun test`
