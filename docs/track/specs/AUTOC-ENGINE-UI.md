# Implementation Plan - AUTOC-ENGINE-UI

Refine the Engine settings UI, fix modal propagation, and centralize workspace orchestration.

## 1. Context & Rules
- **Rule**: `A2UI_Protocol.md` (for future A2UI triggers).
- **Architecture**: Modular structure (Atoms/Molecules/Organisms).
- **Stack**: React 19, Tailwind, Lucide.

## 2. File Changes

### A. Template: `InvestigationLayout.tsx`
- Add `onEngineSettingsOpen?: () => void` to `InvestigationLayoutProps`.
- Pass `onEngineSettingsOpen` to `<LogToolbar />`.

### B. Organism: `LogToolbar.tsx`
- Remove the "Engine" button from the main toolbar to reduce clutter.

### C. Organism: `AIInvestigationSidebar.tsx` (Orchestration Hub)
- Add the "Engine Core" settings button next to the "New Investigation" button.
- This aligns with the user's request to move "engine by workspace" to the "orchestration sidebar".

### D. Page: `SettingsPage.tsx` (Global Core)
- Remove the "Scope" (Global vs Workspace) toggle.
- Add a prominent "Global Core Engine (Drain3)" header to clarify these are system-wide defaults.

### E. Organism: `WorkspaceEngineSettings.tsx` (Refinement)
- Improve UI to distinguish between "Global Default" and "Workspace Override".

## 3. Verification Plan
- Click "Engine" button in AI Sidebar -> Modal should open.
- Verify Settings Page no longer shows workspace selection.
- Verify "Global" and "Drain3" branding is present.
