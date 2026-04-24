# FIX-UX-003: Note Editor Refinement

## 🎯 Objective
Streamline the "Add Note" UX by removing redundant information (`Raw Data`) and preventing UI overlap with the `Batch AI Analysis` action pill.

## 🛠️ Implementation Plan

### 1. Visual Simplification
The `expandedRow` details panel in `VirtualLogTable.tsx` will be refactored:
- **Layout**: Transition from 2-column grid to single focused column.
- **Content**: Remove `Raw Data` `<pre>` block.
- **Header**: Change title to `Log Entry Annotation` for better alignment with the user task.
- **Height**: Reduce redundant padding and max-height for a "Floating Card" bottom panel feel.

### 2. Action Pill Logic
Prevent the `Batch Selection Action Pill` from rendering when a note is being edited:
- **Condition**: Update to `{selectedLogIds.length > 0 && expandedRow === null && (...) }`.

### 3. Guardrails
- **State Preservation**: Ensure the `commentText` remains focused and reactive.
- **Auto-Close**: Keep existing `X` button and `setExpandedRow(null)` behavior.

## ⚖️ Architectural Impact
- **Frontend**: Minor JSX refactor in `VirtualLogTable.tsx`.
- **CSS**: Minor padding adjustments to keep the panel compact.
