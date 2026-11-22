# Common Time Picker Components

## Overview
Leaf UI subcomponents composing the date and time range picker dialog, providing calendar header navigation, month/year selection grids, preset range buttons, live range preview, and numeric time-segment input controls.

## Interface
- `[CalendarHeader.tsx:CalendarHeader]` - Exported React component rendering view-aware month/year header controls (`days`, `months`, `years`) with previous/next navigation and view toggle triggers.
- `[MonthGrid.tsx:MonthGrid]` - Exported React component rendering the 12-month selection grid using `MONTH_NAMES` with active-month highlighting.
- `[PresetsSidebar.tsx:PresetsSidebar]` - Exported React component rendering predefined `PRESETS` time-range buttons and a range reset control.
- `[SelectionPreview.tsx:SelectionPreview]` - Exported React component rendering formatted start/end `DateRange` dates (`MMM d, yyyy`) and zero-padded `HH:MM:SS` preview badges.
- `[TimeControls.tsx:TimeControls]` - Exported React component coordinating start/end `TimeInputRow` controls alongside cancel and `Set Window` apply actions.
- `[TimeInputRow.tsx:TimeInputRow]` - Exported React component (`TimeInputRowProps` from `../types`) grouping hour, minute, and second `TimeSegmentInput` fields for a single boundary.
- `[TimeSegmentInput.tsx:TimeSegmentInput]` - Exported React component (`TimeSegmentInputProps` from `../types`) rendering a two-digit clamped numeric segment input with step buttons, keyboard navigation, and wheel increments.
- `[YearGrid.tsx:YearGrid]` - Exported React component rendering a 12-year selection grid centered around `currentYear`.

## Invariants
- `[CalendarHeader.tsx:CalendarHeader]` `LABEL_BY_VIEW` maps `'days'` to `MMMM yyyy`, `'months'` to `yyyy`, and `'years'` to `'Select Year'`; `onToggleView` and `ChevronsUpDown` are active only when `view` is `'days'` or `'months'`.
- `[CalendarHeader.tsx:CalendarHeader]` Prev/next navigation buttons enforce `disabled={!onPrev}` / `aria-hidden={!onPrev}` and `disabled={!onNext}` / `aria-hidden={!onNext}`.
- `[MonthGrid.tsx:MonthGrid]` Iterates `MONTH_NAMES` by 0-based index `i`, highlights `i === currentMonth`, passes `i` to `onSelectMonth`, and renders 3-character abbreviations (`name.slice(0, 3)`).
- `[PresetsSidebar.tsx:PresetsSidebar]` Reset action always invokes `onReset({ start: '', end: '' })`.
- `[SelectionPreview.tsx:SelectionPreview]` Zero-pads all `HH:MM:SS` values via `String(...).padStart(2, '0')`; when `range?.to` is absent, displays `'Streaming (Now)'` if `range?.from` is set, otherwise `'Waiting for date...'`.
- `[TimeControls.tsx:TimeControls]` End `TimeInputRow` sets `disabled={!hasEndDate}` and `label={hasEndDate ? 'End' : 'End (pick date)'}`; the `Set Window` button enforces `disabled={!canApply}`.
- `[TimeInputRow.tsx:TimeInputRow]` Constrains segment bounds to `max={23}` for hours and `max={59}` for minutes/seconds; `disabled=true` applies `opacity-30 pointer-events-none` on the container without forwarding `disabled` to child inputs.
- `[TimeSegmentInput.tsx:TimeSegmentInput]` Clamps every emitted value via `Math.max(0, Math.min(max, v))` across step buttons, `ArrowUp`/`ArrowDown`, digit entry, wheel events, and blur; renders `value` zero-padded with a no-op `onChange` and handles `/^\d$/` via a 2-character sliding buffer (`pendingRef`).
- `[YearGrid.tsx:YearGrid]` Generates 12 consecutive years `[currentYear - 5, currentYear + 6]` and highlights `y === currentYear`.

## Side Effects
- `[TimeInputRow.tsx:TimeInputRow]` Imperatively mutates DOM focus via `ref.current?.querySelector('input')?.focus()` on minute/second containers when `onNext` fires.
- `[TimeSegmentInput.tsx:TimeSegmentInput]` Mutates `pendingRef.current` on digit entry, Backspace, and `onBlur`.
- `[TimeSegmentInput.tsx:TimeSegmentInput]` Schedules `setTimeout(onNext, 0)` when two digits complete in `handleKeyDown`.
- `[TimeSegmentInput.tsx:TimeSegmentInput]` Calls `e.target.select()` on focus and `e.preventDefault()` on `ArrowUp`, `ArrowDown`, digit keystrokes, and wheel events.

## Verification
- Run: `bun test`
