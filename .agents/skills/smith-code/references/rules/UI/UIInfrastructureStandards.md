# UI Infrastructure Standards (Theme, Hooks, Utils)

## 1. Core Principles (Invariants)
* **Purity:** `utils` must be pure functions. `theme` must be deterministic.
* **Scope:** UI Infrastructure handles **presentation state** (theme, toggles, motion) and **device signals** (screen size, platform).
* **Isolation:** NEVER import `packages/core`. No API calls. No direct persistence (localStorage/AsyncStorage).
* **Platform Split:**
    * Shared logic: `*.ts` (Must run in Node/Browser/RN environment).
    * Web-specific: `*.tsx` / `*.ts` (if DOM dependent).
    * Native-specific: `*.native.tsx` / `*.native.ts` (if RN API dependent).

## 2. Workflow (Extension Protocol)
1.  **Is it a Style/Value?** -> Check **tokens**.
2.  **Is it Stateful Logic (UI)?** -> Check **hooks**.
3.  **Is it Pure Logic?** -> Check **utils**.
4.  **Does it fetch data?** -> **Move to Page/Core**.

## 3. Infrastructure Hierarchy (packages/ui)

### 3.1 Theme (`/theme`)
**Purpose:** Defines the design token contract and merge logic.
**Rules:**
* **Definitions Only:** Type definitions and Token objects.
* **No Components:** Theme Providers belong in `index` or `App`, not inside the theme definition files.
* **Canonical:** `createTheme.ts`, `types.ts`.

### 2.2 Hooks (`/hooks`)
**Purpose:** Reusable UI logic and environment signals.
**Allowed:** `useTheme`, `useDisclosure`, `useMediaQuery`, `usePlatform`.
**Rules:**
* **UI State Only:** No business logic state (e.g., no `useUserSession` here).
* **No Fetching:** Hooks must not trigger network requests.
* **Platform Specifics:** Use `.native.ts` for hooks relying on RN APIs.

### 2.3 Utils (`/utils`)
**Purpose:** Pure stateless helper functions.
**Allowed:** `cx` (class merging), `hexToRgba`, `a11y` helpers.
**Rules:**
* **Pure:** Output depends strictly on input. No side effects.
* **No DOM/Native Access:** If you need `window` or `Dimensions`, use a Hook, not a Util, or split by file extension.

## 4. File Standards
* **Theme:** `src/theme/createTheme.ts`
* **Hooks:** `src/hooks/[name].ts` (optional `[name].native.ts`)
* **Utils:** `src/utils/[name].ts`
* **Exports:** `src/index.ts` must re-export all 3 folders.

## 5. Forbidden Patterns (Strict)
1.  **Core Leak:** `import { User } from '@{scope}/core'` (UI is generic).
2.  **Impure Utils:** `localStorage.getItem('theme')` inside a `utils` function (Use a Hook/Provider).
3.  **Data Fetching:** `useQuery` or `fetch` inside `ui/hooks`.
4.  **Platform Crash:**
    * Accessing `document` or `window` in a shared `*.ts` util (Crashes Native).
    * Importing `react-native` in a shared `*.ts` util (Crashes Web).

## 6. Golden Example (The Ideal Hook)
```typescript
// packages/ui/src/hooks/useDisclosure.ts
import { useState, useCallback } from 'react';

// Strict Return Type (Tuple vs Object)
type UseDisclosureReturn = {
  isOpen: boolean;
  onOpen: () => void;
  onClose: () => void;
  onToggle: () => void;
};

// Pure UI Logic. No Business Logic (Auth/Fetch).
export const useDisclosure = (initialState = false): UseDisclosureReturn => {
  const [isOpen, setIsOpen] = useState(initialState);

  // Memoized handlers to prevent prop-drilling re-renders
  const onOpen = useCallback(() => setIsOpen(true), []);
  const onClose = useCallback(() => setIsOpen(false), []);
  const onToggle = useCallback(() => setIsOpen((prev) => !prev), []);

  return { isOpen, onOpen, onClose, onToggle };
};
```