# Molecules

## Overview
Atomic Design compatibility barrel directory re-exporting composite molecule components from `@/components/common/*`, alongside a nested `time-picker` module.

## Interface
- `[AddColumnModal.tsx:export *]` - Re-exports all symbols from `@/components/common/AddColumnModal`.
- `[ClusterRow.tsx:export *]` - Re-exports all symbols from `@/components/common/ClusterRow`.
- `[ConfirmationDialog.tsx:export *]` - Re-exports all symbols from `@/components/common/ConfirmationDialog`.
- `[DashboardModeToggle.tsx:export *]` - Re-exports all symbols from `@/components/common/DashboardModeToggle`.
- `[FacetExtractionSettings.tsx:export *]` - Re-exports all symbols from `@/components/common/FacetExtractionSettings`.
- `[FacetList.tsx:export *]` - Re-exports all symbols from `@/components/common/FacetList`.
- `[FilterBuilder.tsx:export *]` - Re-exports all symbols from `@/components/common/FilterBuilder`.
- `[HardwareAcceleration.tsx:export *]` - Re-exports all symbols from `@/components/common/HardwareAcceleration`.
- `[HierarchyTree.tsx:export *]` - Re-exports all symbols from `@/components/common/HierarchyTree`.
- `[HighlightBuilder.tsx:export *]` - Re-exports all symbols from `@/components/common/HighlightBuilder`.
- `[IngestionOverlay.tsx:export *]` - Re-exports all symbols from `@/components/common/IngestionOverlay`.
- `[LevelBar.tsx:export *]` - Re-exports all symbols from `@/components/common/LevelBar`.
- `[ModelWeightsStatus.tsx:export *]` - Re-exports all symbols from `@/components/common/ModelWeightsStatus`.
- `[NativeFilePicker.tsx:export *]` - Re-exports all symbols from `@/components/common/NativeFilePicker`.
- `[ProcessingNotification.tsx:export *]` - Re-exports all symbols from `@/components/common/ProcessingNotification`.
- `[SearchBar.tsx:export *]` - Re-exports all symbols from `@/components/common/SearchBar`.
- `[SourceItem.tsx:export *]` - Re-exports all symbols from `@/components/common/SourceItem`.
- `[SourceSelector.tsx:export *]` - Re-exports all symbols from `@/components/common/SourceSelector`.
- `[TimeRangePicker.tsx:export *]` - Re-exports all symbols from `@/components/common/TimeRangePicker`.
- `[WorkspaceTabs.tsx:export *]` - Re-exports all symbols from `@/components/common/WorkspaceTabs`.
- Child contract: [time-picker](./time-picker/README.md).

## Invariants
- `None`

## Side Effects
- `None`

## Verification
- Run: `bun test`
