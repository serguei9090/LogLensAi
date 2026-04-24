# FIX-UX-002: Selection Logic Parity

## 🎯 Objective
Align the `VirtualLogTable` row selection behavior with standard OS/Diagnostic UX. Standard clicks should select a single row and clear others, while multi-selection is explicitly reserved for `Ctrl`/`Shift` modifier keys.

## 🛠️ Implementation Plan

### 1. Modified Selection Sequence
The `handleSelectRow` function in `src/components/organisms/VirtualLogTable.tsx` will be refactored:

| Interaction | Expected Result |
|---|---|
| **Standard Click** | Clear `selectedLogIds` → Set to `[id]` |
| **Ctrl + Click** | `toggleLogSelection(id)` (Additive/Subtractive) |
| **Cmd + Click** | `toggleLogSelection(id)` (Additive/Subtractive) |
| **Shift + Click** | Calculate indices (start to end) → Select range |
| **Shift + Ctrl + Click** | Calculate range and ADD to existing selection |

### 2. Guardrails
- Ensure `lastSelectedId` state is updated after every interaction to preserve the range anchor.
- If the virtual table is empty or the `lastSelectedId` is no longer in the current view (unfiltered list), fallback to selecting only the clicked row.

## ⚖️ Architectural Impact
- **Store**: Uses existing `useInvestigationStore` actions (`setSelectedLogIds`, `toggleLogSelection`).
- **Performance**: No impact. Re-renders will only trigger on selection state change as expected.
