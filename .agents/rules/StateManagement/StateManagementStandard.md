# State Management Standards (Global)

## 1. Core Principles (Invariants)
*   **Tri-Partition Rule:** State MUST be strictly categorized into one of three buckets. NO intersection.
    1.  **Server State:** Data from API (Async, Cached). Owned by `TanStack Query`.
    2.  **Client State:** Global UI config (Theme, AuthUser). Owned by `Zustand`.
    3.  **URL State:** Shareable config (Filters, Pagination, ID). Owned by `React Router` (`useSearchParams`).
*   **No "Derived State" in Store:** If it can be calculated from existing state, calculate it during render or in a selector. DO NOT store it.
*   **Form State Isolation:** Form inputs belong in `react-hook-form` or local `useState`. NEVER in Global Client State (Zustand) to prevent re-render storms.

## 2. Workflow (Decision Tree)
1.  **Is it Async/API data?** -> **Server State** (`React Query`).
2.  **Is it UI Theme/Config?** -> **Client State** (`Zustand`).
3.  **Is it URL Shareable?** -> **URL State** (`SearchParams`).
4.  **Is it Form Input?** -> **Local State** (`react-hook-form`).

## 3. Directory & Naming
*   Path: `src/stores/[domain].store.ts`
*   Naming: `use[Domain]Store` (e.g., `useAuthStore`).
*   Selector usage: `const user = useAuthStore(s => s.user)` (Atomic selection).

## 4. Technology Stack (Strict)
*   **Client Global:** `zustand` (Single Source of Truth for UI global).
*   **Server Global:** `@tanstack/react-query` (Single Source of Truth for API).
*   **URL:** `react-router-dom` (Single Source of Truth for Deep Linking).

## 5. Forbidden Patterns (Strict)
1.  **Effect Pollution:** `useEffect(() => setState(val), [val])`. **STOP.** Derive it during render.
2.  **State Duplication:** Storing API response in Zustand. (Use `useQuery` data directly or `select` option).
3.  **Prop Drilling:** Passing state down >2 components. (Use Context or Composition).
4.  **Zombie Children:** Accessing store without a specific selector (e.g., `const { user } = useStore()` causes re-renders on *any* store change).

## 6. Golden Example (The Ideal Store)
```typescript
import { create } from 'zustand';

interface UIState {
  theme: 'dark' | 'light';
  isSidebarOpen: boolean;
  actions: {
    toggleSidebar: () => void;
    setTheme: (theme: 'dark' | 'light') => void;
  };
}

export const useUIStore = create<UIState>((set) => ({
  theme: 'dark',
  isSidebarOpen: true,
  actions: {
    toggleSidebar: () => set((state) => ({ isSidebarOpen: !state.isSidebarOpen })),
    setTheme: (theme) => set({ theme }),
  },
}));

export const useTheme = () => useUIStore((s) => s.theme);
export const useSidebarActions = () => useUIStore((s) => s.actions);
```
