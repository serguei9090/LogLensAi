# FIX-UI-002: ReferenceError Layers not defined in LogToolbar

## Issue Description
After the implementation of workspace-specific engine settings, the `LogToolbar` component crashed with `ReferenceError: Layers is not defined`.

## Root Cause
The `Layers` icon from `lucide-react` was used in the `LogToolbar` component but was not included in the import statement at the top of the file.

## Resolution
Added `Layers` to the `lucide-react` import list in `src/components/organisms/LogToolbar.tsx`.

## Verification Steps
- Component renders without crash.
- "Engine" button displays the `Layers` icon correctly.
