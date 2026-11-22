# Molecules Time Picker

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
- `[types.ts:TimeRange]` - Interface `{ start: string; end: string; label?: string }`.
- `[types.ts:TimeRangePickerProps]` - Readonly interface `{ value: TimeRange; onChange: (range: TimeRange) => void; className?: string }`.
- `[types.ts:TimeSegmentInputProps]` - Readonly interface `{ value: number; max: number; onChange: (v: number) => void; onNext?: () => void }`.
- `[types.ts:TimeInputRowProps]` - Readonly interface for `TimeInputRow` (`color: 'green' | 'amber'`).
- `[types.ts:CalendarView]` - Union type `'days' | 'months' | 'years'`.
- `[constants.ts:PRESETS]` - Readonly tuple of 6 preset objects (`Last 15 min` through `Today`) returning `{ start: string; end: '' }`.
- `[constants.ts:MONTH_NAMES]` - Array of 12 English month names (`January`–`December`).
- `[utils.ts:toNominalISO]` - Function formatting a `Date` as local `"yyyy-MM-dd'T'HH:mm:ss"`.
- `[TimeRangePicker.tsx:TimeRangePicker]` - React component coordinating the popover, `PresetsSidebar`, dual `DayPicker`/`MonthGrid`/`YearGrid` views, `SelectionPreview`, and `TimeControls`.
- Child contract: [components](./components/README.md).

## Invariants
- `[utils.ts:toNominalISO]` Formats dates in local time (`"yyyy-MM-dd'T'HH:mm:ss"`) without UTC conversion.
- `[constants.ts:PRESETS]` Every preset `getValue()` yields a nominal ISO start timestamp paired with an empty `end` string (`''`).
- `[TimeRangePicker.tsx:handleOpenChange]` Opening the popover resets `view = 'days'` and `activeSide = 'left'` while syncing draft range and `HH:MM:SS` fields from `value` (defaulting start to `00:00:00` and end to current local time when omitted).
- `[TimeRangePicker.tsx:handleApply]` Exits early when `!range?.from`, zeroes milliseconds via `setHours(..., 0)`, emits `end: ''` when `!range.to`, and formats via `toNominalISO`.
- `[TimeRangePicker.tsx:handleToggleView]` Cycles `view` strictly `'days' -> 'months' -> 'years' -> 'days'` for `activeSide`; `handleMonthSelect` switches to `'days'` and `handleYearSelect` switches to `'months'`; prev/next in `'months'`/`'years'` shift `activeSide` year by `±1`/`±12`.
- `[TimeRangePicker.tsx:displayText]` Resolves trigger label in order: `value.label` -> `'All Time'` (when `!value.start`) -> `<start> → <end or now>`.

## Side Effects
- `[constants.ts:PRESETS]` `getValue()` reads system wall-clock time via `new Date()`.
- `[TimeRangePicker.tsx:TimeRangePicker]` Reads `new Date()` on state initialization and popover open, updates local React state, and invokes `onChange` from `handleApply`, `handlePreset`, and `PresetsSidebar`'s `onReset`.

## Verification
- Run: `bun test`
