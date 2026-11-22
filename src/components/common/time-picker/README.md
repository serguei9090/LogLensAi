# Common Time Picker

## Overview
Popover date-and-time window selector combining a dual-month calendar (`react-day-picker`), drill-down month/year grids, relative presets, and second-precision start/end controls.

## Interface
- `[index.ts:TimeRangePicker]` - Re-exports `TimeRangePicker` from `./TimeRangePicker`.
- `[index.ts:CalendarView]` - Re-exports type `CalendarView` from `./types`.
- `[index.ts:TimeInputRowProps]` - Re-exports type `TimeInputRowProps` from `./types`.
- `[index.ts:TimeRange]` - Re-exports type `TimeRange` from `./types`.
- `[index.ts:TimeRangePickerProps]` - Re-exports type `TimeRangePickerProps` from `./types`.
- `[index.ts:TimeSegmentInputProps]` - Re-exports type `TimeSegmentInputProps` from `./types`.
- `[index.ts:MONTH_NAMES]` - Re-exports `MONTH_NAMES` from `./constants`.
- `[index.ts:PRESETS]` - Re-exports `PRESETS` from `./constants`.
- `[index.ts:toNominalISO]` - Re-exports `toNominalISO` from `./utils`.
- `[types.ts:TimeRange]` - Exported interface `{ start: string; end: string; label?: string }`.
- `[types.ts:TimeRangePickerProps]` - Exported interface `{ readonly value: TimeRange; readonly onChange: (range: TimeRange) => void; readonly className?: string }`.
- `[types.ts:TimeSegmentInputProps]` - Exported readonly interface `{ value: number; max: number; onChange: (v: number) => void; onNext?: () => void }`.
- `[types.ts:TimeInputRowProps]` - Exported readonly interface for `TimeInputRow` (`color: 'green' | 'amber'`).
- `[types.ts:CalendarView]` - Exported union `'days' | 'months' | 'years'`.
- `[constants.ts:PRESETS]` - Exported `as const` tuple of 6 relative range presets (`Last 15 min` through `Today`).
- `[constants.ts:MONTH_NAMES]` - Exported 12-item array `'January'`–`'December'`.
- `[utils.ts:toNominalISO]` - Exported function formatting `Date` as local `"yyyy-MM-dd'T'HH:mm:ss"`.
- `[TimeRangePicker.tsx:TimeRangePicker]` - Exported React component coordinating popover state, draft range editing, view switching, and range emission.
- Child contract: [components](./components/README.md).

## Invariants
- `[utils.ts:toNominalISO]` Formats dates in local wall-clock time (`"yyyy-MM-dd'T'HH:mm:ss"`) without UTC conversion.
- `[constants.ts:PRESETS]` Declared `as const`; every preset `getValue()` emits `{ start: toNominalISO(...), end: '' }`.
- `[TimeRangePicker.tsx:TimeRangePicker]` Leaves `range` undefined when `value.start` is falsy; initializes start time to `00:00:00` and end time to current wall-clock time when absent; `handleOpenChange(true)` resets `view` to `'days'` and `activeSide` to `'left'` while syncing draft state from `value`.
- `[TimeRangePicker.tsx:TimeRangePicker]` `handleApply` exits early if `!range?.from`, zeroes milliseconds via `setHours(..., 0)`, emits `end: ''` if `range.to` is absent, omits `label`, and closes the popover; `handlePreset` emits `{ ...preset.getValue(), label: preset.label }` and closes.
- `[TimeRangePicker.tsx:TimeRangePicker]` `handleToggleView` cycles `'days' -> 'months' -> 'years' -> 'days'` for `activeSide`, `handleMonthSelect` returns to `'days'`, and `handleYearSelect` moves to `'months'`; prev/next shift years by `±1` (`'months'`) or `±12` (`'years'`).
- `[TimeRangePicker.tsx:TimeRangePicker]` Display text resolves `value.label` -> `'All Time'` (when `!value.start`) -> formatted `start → end | now`.

## Side Effects
- `[constants.ts:PRESETS]` `preset.getValue()` reads `new Date()`.
- `[TimeRangePicker.tsx:TimeRangePicker]` Reads `new Date()` during state initialization, render (`nowRef`), and `handleOpenChange(true)`; mutates local React state; invokes `onChange` on apply, preset selection, and reset.

## Verification
- Run: `bun test`
