# Molecules Time Picker Components

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
- `[CalendarHeader.tsx:CalendarHeader]` View toggle button binds `onClick={onToggleView}` and renders `ChevronsUpDown` only when `view` is `"days"` or `"months"`; in `"years"` view, label is `"Select Year"` and `onClick` is `undefined`.
- `[CalendarHeader.tsx:CalendarHeader]` Prev and Next buttons enforce `disabled={!onPrev}` / `aria-hidden={!onPrev}` and `disabled={!onNext}` / `aria-hidden={!onNext}` with `pointer-events-none select-none` when omitted.
- `[MonthGrid.tsx:MonthGrid]` Renders 3-character prefixes of `MONTH_NAMES`, passes 0-based index `i` to `onSelectMonth(i)`, and highlights `i === currentMonth`.
- `[PresetsSidebar.tsx:PresetsSidebar]` Clicking Reset always invokes `onReset({ start: "", end: "" })`; preset buttons forward each `PRESETS` item to `onSelectPreset`.
- `[SelectionPreview.tsx:SelectionPreview]` Zero-pads time segments via `String(...).padStart(2, "0")`; renders `"No start date selected"` and `"Waiting for date..."` when `range?.from` is falsy, and `"Streaming (Now)"` when `range?.from` is set without `range?.to`.
- `[TimeControls.tsx:TimeControls]` End `TimeInputRow` sets `disabled={!hasEndDate}` and switches label between `"End"` and `"End (pick date)"`; the `"Set Window"` button enforces `disabled={!canApply}`.
- `[TimeInputRow.tsx:TimeInputRow]` Bounds hours to `max={23}` and minutes/seconds to `max={59}`; defaults `disabled` to `false`, applies `pointer-events-none` when `disabled` is true, and passes `onNext` only for hours (`mRef`) and minutes (`sRef`).
- `[TimeSegmentInput.tsx:TimeSegmentInput]` Clamps all emitted values to `[0, max]` via `Math.max(0, Math.min(max, v))`, formats display text with `String(value).padStart(2, "0")`, uses a no-op native `onChange`, sets `tabIndex={-1}` on step buttons, retains at most 2 trailing digits in `pendingRef.current`, and fires `onNext` only when `next.length === 2` and `onNext` is defined.
- `[YearGrid.tsx:YearGrid]` Renders 12 consecutive years `[currentYear - 5, currentYear + 6]` and highlights `y === currentYear`.

## Side Effects
- `[TimeInputRow.tsx:TimeInputRow]` `focusFirst` performs imperative DOM lookup and focus via `ref.current?.querySelector("input")?.focus()` on `mRef` and `sRef`.
- `[TimeSegmentInput.tsx:TimeSegmentInput]` Mutates `pendingRef.current` on digit keydown, Backspace, and `onBlur` (resetting to `""`).
- `[TimeSegmentInput.tsx:TimeSegmentInput]` Calls `e.preventDefault()` on `ArrowUp`, `ArrowDown`, digit (`/^\d$/`), and wheel events.
- `[TimeSegmentInput.tsx:TimeSegmentInput]` Schedules `setTimeout(onNext, 0)` when two digits complete and `onNext` is defined.
- `[TimeSegmentInput.tsx:TimeSegmentInput]` Calls `e.target.select()` on focus.

## Verification
- Run: `bun test`
