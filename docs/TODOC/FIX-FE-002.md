# FIX-FE-002: Frontend Sidebar Accessibility & Type Safety

## 📝 Issue Description
The `Sidebar` and `AIInvestigationSidebar` use `role="button"` on `div` elements, breaking native focus management and accessibility. Additionally, the `SidebarProps` ignore immutability standards.

## 🔍 Root Cause Analysis
1. **Accessibility Debt**: Using `div` for buttons requires manual `tabIndex` and `onKeyDown` listeners, which are less reliable than native `<button>`.
2. **Type Safety**: `SidebarProps` members are mutable, increasing potential for side-effects.
3. **Logic Density**: Nested ternaries in `Sidebar.tsx` (Tooltip vs Content) are hard to maintain.

## 🛠️ Implementation Plan

### 1. Frontend (@frontend)
- **`src/components/organisms/Sidebar.tsx`**:
  - Apply `readonly` to all members of `SidebarProps`.
  - Replace all workspace and navigation item `div[role=button]` with `<button type="button">`.
  - Flattern Tooltip/Content logic: define the button content before the return.
- **`src/components/organisms/AIInvestigationSidebar.tsx`**:
  - Final cleanup: ensure the resize handle has appropriate roles (separator/slider).

## ✅ Verification
- Verify keyboard navigation (Tab, Space, Enter) for both sidebars.
- Ensure no "asChild" or "button-in-button" errors in development console.
