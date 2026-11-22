# Pages

## Overview
Compatibility barrel re-exports bridging top-level `@/components/pages/*` imports to `@/features/*` page modules, alongside co-located `dashboard` and `investigation` page implementations.

## Interface
- `[DashboardPage.tsx:DashboardPage]` - Re-exports `DashboardPage` (named and default) from `@/features/dashboard/DashboardPage`.
- `[InvestigationPage.tsx:InvestigationPage]` - Re-exports `InvestigationPage` from `@/features/investigation/InvestigationPage`.
- `[SettingsPage.tsx:SettingsPage]` - Re-exports `SettingsPage` from `@/features/settings/SettingsPage`.
- Child contracts: [dashboard](./dashboard/README.md), [investigation](./investigation/README.md).

## Invariants
- `None`

## Side Effects
- `None`

## Verification
- Run: `bun test`
