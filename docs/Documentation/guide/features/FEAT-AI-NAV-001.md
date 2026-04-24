# Feature Spec: AI Navigation & History Search (FEAT-AI-NAV-001)

## 📌 Overview
Enhance the accessibility and discoverability of AI investigations by adding a toolbar trigger and a searchable command-palette modal for past investigation history.

## 🎯 Objectives
- **Global Access**: Add an AI trigger icon to the main `LogToolbar`.
- **History Management**: limit the "Recent Investigations" list in the sidebar and add a "Show more..." option.
- **Deep Search**: Implement a centered modal for searching through all past AI investigations with a premium, search-first interface.

## 🛠️ Technical Plan

### Frontend (Atomic Design)
1. **Atoms**:
   - `AIToolbarButton`: A ghost/muted button in `LogToolbar` using the `Sparkles` icon.
2. **Organisms**:
   - `SearchSessionsModal`: A centered dialog (`shadcn` Dialog + Search Input) that filters the `sessions` array from `useAiStore`.
3. **Template Updates**:
   - `InvestigationPage`: Inject the `SearchSessionsModal` and coordinate its visibility.

### Logic Flow
1. User clicks "Show more..." in the AI Sidebar investigation history dropdown.
2. `SearchSessionsModal` opens.
3. User types in search box; list filters in real-time.
4. User selects a session; `setSession(id)` is called, modal closes, and sidebar opens (if closed).

## ✅ Acceptance Criteria
- AI icon appears after the bookmarks icon in `LogToolbar`.
- Sidebar history list truncates at 4 items.
- "Show more..." appears if > 4 sessions exist.
- "Show more..." opens a centered search modal.
- Search modal is keyboard accessible and follows the project's dark aesthetic.
