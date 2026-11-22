# Templates

## Overview
Atomic Design compatibility barrel directory re-exporting page layout templates from `@/features/shell/*` and `@/features/investigation/*`.

## Interface
- `[AppLayout.tsx:export *]` - Re-exports all symbols from `@/features/shell/AppLayout`.
- `[InvestigationLayout.tsx:export *]` - Re-exports all symbols from `@/features/investigation/InvestigationLayout`.

## Invariants
- `None`

## Side Effects
- `None`

## Verification
- Run: `bun test`
