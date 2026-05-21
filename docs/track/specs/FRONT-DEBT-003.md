Assume Role: Product Manager (@pm)

# FRONT-DEBT-003: Universal Replacement of Raw Button Elements with Button Atom

## 🎯 Goal
Standardize all interactive click elements to use the shadcn/base-ui `Button` atom to maintain design system consistency, keyboard focus ring visibility, and appropriate states.

## 🛠️ Requirements
- Audit all organisms in `src/components/organisms/` for occurrences of `<button>` tags.
- Systematically migrate raw `<button>` elements to `Button` from `@/components/ui/button`.
- Map relevant style classes to standard variants/sizes where applicable, or pass custom classes via the `className` prop.
- Target components:
  - `src/components/atoms/SidebarNavItem.tsx` (newly extracted)
  - `src/components/organisms/CustomParserModal.tsx`
  - `src/components/organisms/ImportFeedModal.tsx`
  - `src/components/organisms/OrchestratorHub.tsx`
  - `src/components/organisms/AIInvestigationSidebar.tsx`
  - `src/components/organisms/LogToolbar.tsx`
  - `src/components/organisms/SettingsPanel.tsx`
