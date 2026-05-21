Assume Role: Product Manager (@pm)

# FRONT-DEBT-002: Refactor Sidebar and InvestigationPage to Extract Components

## 🎯 Goal
Decompose oversized frontend container files to improve modularity, component reusability, and readability.

## 🛠️ Requirements
- Extract the `SidebarNavItem` component from `src/components/organisms/Sidebar.tsx` into a standalone atom component `src/components/atoms/SidebarNavItem.tsx`.
- Update `SidebarNavItem` to use the React `Button` atom from `@/components/ui/button` instead of a raw `<button>` tag to combine with `FRONT-DEBT-003`.
- Update `Sidebar.tsx` to import and render `SidebarNavItem`.
- Ensure all type definitions and imports are correctly resolved and formatted using Biome.
- Audit `InvestigationPage.tsx` to confirm it is clean and does not contain oversized inline elements.
