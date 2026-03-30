---
id: IMP-UX-001
title: Task Implementation Plan: Sidebar Collapse (UX-001)
author: Antigravity (@pm, @architect, @frontend)
status: Pending Approval
---

# Implementation Plan: Sidebar Collapse (UX-001)

## 📋 Goal
Add a modern, professional collapse/expand functionality to the LogLensAi sidebar to maximize log viewing workspace while maintaining easy navigation.

## 🖼️ Visual Proposal
The mockup has been generated and should be visible in the current session.

## 🏗️ Technical Architecture

### 1. State Management
We will introduce `uiStore.ts` using Zustand to manage global UI flags.
- `sidebarCollapsed`: `boolean` (stored in persistent state).
- `toggleSidebar`: `() => void`.

### 2. Layout Transitions
- The main `AppLayout` or `InvestigationPage` will use a dynamic `grid-cols-[auto_1fr]` or similar layout.
- Use `framer-motion` for buttery smooth transitions of the sidebar width and text opacity.

### 3. Sidebar UI Refactor (`src/components/organisms/Sidebar.tsx`)
- **Header**: Add a `PanelLeftClose` / `PanelLeftOpen` toggle button.
- **Logo**: Shrink text when collapsed.
- **Workspace Section**: 
    - Hide `span` labels.
    - Wrap items in `Tooltip` icons for descriptive hover text.
    - Hide the `+` button in collapsed mode (access via shortcut or tooltip context menu?).
- **Bottom Nav**:
    - Hide `span` labels.
    - Retain icons with tooltips.

## 🚶 Implementation Steps
1. **Create `src/store/uiStore.ts`**: Persistent UI state management.
2. **Refactor `Sidebar.tsx`**: Update component to handle `isCollapsed` prop.
3. **Update Layout**: Ensure main content expands correctly when sidebar is collapsed.
4. **Style Polish**: Implement transitions and hover states for the mini icons.

## ❓ Questions for the User
1. Do you prefer the "Collapse" toggle at the **top** (near the logo) or at the **bottom** (near settings)?
2. Should we implement a keyboard shortcut (e.g., `Ctrl + \`) for this as well?

---
> [!IMPORTANT]
> Once you approve this plan, I will proceed with the code implementation following the @frontend workflow.
