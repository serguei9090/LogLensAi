# Task: Fix ReferenceError Trash2 (FIX-FE-003)

## 📌 Problem
A `ReferenceError: Trash2 is not defined` occurs in the AI Investigation Sidebar because the `Trash2` icon was removed from the imports, but a usage remained in the Historical Investigation dropdown.

## 🛠️ Implementation Logic
- Restore `Trash2` to the `lucide-react` import list in `src/components/organisms/AIInvestigationSidebar.tsx`.

## 🧪 Testing
1. Open the AI Sidebar.
2. Open the History dropdown (clock icon).
3. Verify that the delete (trash) icons appear on hover for each session and do not crash the UI.
