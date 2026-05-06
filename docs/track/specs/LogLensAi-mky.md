# Implementation Spec: Dashboard Refinement (Context Selector & Professional StatCards)

**Bead ID**: LogLensAi-mky
**Status**: DRAFT
**Persona**: @pm

## 1. Overview
This task refines the LogLensAi Dashboard to improve clarity, professionalism, and user experience. The key focus is on strict context selection (workspaces only), improving dropdown visual quality with glassmorphism, and redesigning the summary cards to be more compact and professionally presented.

## 2. Proposed Changes

### 2.1 Context Selector (DashboardPage.tsx)
- **Selection Logic**:
  - Remove the "Global (All)" option from the `selectedWorkspaceId` state and selector.
  - Default the context to the active workspace on load.
  - Ensure the selector only lists actual workspaces.
- **Display**:
  - Use the full workspace name in the selector trigger and items.
- **Hierarchy Update**:
  - The dashboard view will now strictly represent the selected workspace context.
  - When a workspace is selected, the "Log Source" selector will remain to allow further filtering within that workspace.

### 2.2 Dropdown Design (select.tsx & global.css)
- **Visual Style**:
  - Apply glassmorphism to `SelectContent` (popover menu).
  - Use `backdrop-blur-md`, a semi-transparent background (e.g., `bg-popover/80`), and a subtle border.
  - Ensure contrast is maintained for readability.
- **Item Styling**:
  - Refine `SelectItem` to have a clear hover state that aligns with the premium design theme (`bg-primary-green/10` or similar).

### 2.3 Professional StatCards (DashboardPage.tsx)
- **Layout Redesign**:
  - Move the "Total Workspaces" card (or its replacement) into the same row as other cards.
  - Reduce the height and padding of `StatCard` components to make them more compact.
- **Content Update**:
  - Replace the "Workspaces" card with a "Catalogs" card.
  - **Catalogs**: Represents the total number of logs/sources loaded in the current context.
  - Updated Card List:
    1. **Total Logs**: (Icon: Database) - Filtered scope count.
    2. **Patterns**: (Icon: Layers) - Drain3 templates identified.
    3. **Active Streams**: (Icon: Activity) - Live ingestion count.
    4. **Catalogs**: (Icon: List) - Total unique logs/sources in the workspace.
- **Visual Polish**:
  - Use more subtle icons and refined typography (font-mono for values).
  - Improve the hover interaction with smoother transitions and subtle scale/glow effects.

## 3. Verification Plan

### 3.1 Visual Audit
- Use `tauri-mcp-server` to take screenshots of the new dashboard.
- Verify:
  - No "Global" option in context selector.
  - Dropdown menu transparency is replaced with professional glassmorphism.
  - StatCards are smaller and follow the new content mapping.
  - Overall layout is balanced and professional.

### 3.2 Functional Audit
- Ensure selecting different workspaces updates all cards and the "Log Source" dropdown correctly.
- Verify "Refresh" button still works with the new context constraints.
