# Refactoring Plan: Decompose `TimeRangePicker.tsx` (874 lines)

## 1. Context & Motivation
- **File**: `src/components/molecules/TimeRangePicker.tsx` (874 lines)
- **Goal**: Decompose into focused subcomponents under `src/components/molecules/time-picker/` with all files well below the 300–400 line threshold.
- Maintain 100% backward compatibility for all callers (`src/components/organisms/LogToolbar.tsx`, `src/components/pages/dashboard/components/DashboardFilters.tsx`, `src/components/pages/dashboard/hooks/useDashboardData.ts`).
- Retain exact nominal ISO handling and DayPicker styling.

---

## 2. Target File Structure (`src/components/molecules/time-picker/`)

```
src/components/molecules/time-picker/
├── types.ts                    (~35 lines)  - TimeRange, CalendarView, TimeRangePickerProps, etc.
├── constants.ts                (~45 lines)  - PRESETS, MONTH_NAMES
├── utils.ts                    (~15 lines)  - toNominalISO
├── components/
│   ├── TimeSegmentInput.tsx    (~85 lines)  - Numeric segment with wheel & arrow navigation
│   ├── TimeInputRow.tsx        (~55 lines)  - Row with start/end label and H:M:S segments
│   ├── MonthGrid.tsx           (~40 lines)  - 3x4 month selection grid
│   ├── YearGrid.tsx            (~40 lines)  - 3x4 12-year window grid
│   ├── CalendarHeader.tsx      (~85 lines)  - Adaptive month/year/day header with drilldown
│   ├── PresetsSidebar.tsx      (~45 lines)  - Quick select presets and reset button
│   ├── SelectionPreview.tsx    (~65 lines)  - Start and end selection timestamps preview
│   └── TimeControls.tsx        (~75 lines)  - Time input rows + Set Window / Cancel buttons
├── TimeRangePicker.tsx         (~200 lines) - Slim coordinator popover component
└── index.ts                    (~15 lines)  - Public barrel export

src/components/molecules/TimeRangePicker.tsx (~10 lines) - Backward-compatibility proxy re-export
```

---

## 3. Verification Plan
1. `bun run build` to verify type checking, JSX compilation, and asset bundling.
2. Verify all importers resolve types and component without regression.
