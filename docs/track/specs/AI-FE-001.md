# AI-FE-001: Multi-Log Selection & Actions Refactor

## 🎯 Objective
Enable users to select multiple log lines via checkboxes and interact with them collectively (AI analysis, batch filters) while separating row selection from interaction logic.

## 🏗️ UI/UX Design

### 1. The Column Shift
- **Checkbox (W-10)**: New column on the far left. Toggles row selection in `investigationStore`.
- **Actions (W-80)**: Replaces the 'Note' column. 
  - **Note Icon**: Sticky note icon if `has_comment` is true. `onClick` to edit.
  - **AI Context Icon**: Pulse/Sparkles icon if the log is part of an active session. `Hover` shows session title.

### 2. Interaction Model
- **Click anywhere on row**: No longer expands. Toggles row checkbox.
- **Double Click**: Opens the Note card.
- **Selection Action Pill**: Floating toolbar (same style as currently) showing:
  - `Analyze with AI` (if multiple rows selected)
  - `Add to Current Chat` (if a session is active)
  - `Bulk Include/Exclude` filters.

### 3. State Management (`investigationStore.ts`)
```typescript
interface AISelectionState {
    selectedRowIds: Set<number>;
    activeSessionId?: string;
}
```

## 🛠️ Components involved:
- `VirtualLogTable.tsx`: Add checkbox logic and Actions column.
- `investigationStore.ts`: Track `selectedRowIds` per log source.
- `StatusIcon.tsx` (New Atom): Renders the state of a log entry (Note, AI, etc.).
