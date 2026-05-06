# Testing Standards (Global)

## 1. Core Principles (Invariants)
*   **Behavior Over Implementation:** Test *what* it does (User flows), not *how* it does it (Internal state).
*   **The "Pyramid":**
    1.  **Unit (Speed):** `Vitest`. Test pure logic, utils, and isolated components. Mock all network/IO.
    2.  **Integration/E2E (Reality):** `Playwright`. Test full user flows in real browser context.
*   **Zero Flake:** Tests must be deterministic. If a test is flaky, fix it immediately or delete it.

## 2. File Standards
*   Unit Tests: `src/**/__tests__/*.test.tsx` or `src/**/*.test.tsx`.
*   E2E Tests: `tests/e2e/*.spec.ts`.
*   Setup: `src/setupTests.ts` (Global mocks, MSW server).

## 3. Mocking Rules (Strict)
*   **Network:** ALWAYS mock network requests in Unit tests using `MSW` (Mock Service Worker). NEVER hit real APIs in `Vitest`.
*   **Hooks:** DO NOT mock custom hooks unless they interact with native modules or external side-effects (e.g. `useWindowSize`, `useAuth`).
*   **Date:** Freeze time with `vi.setSystemTime` for date-dependent logic.

## 4. Forbidden Patterns (Strict)
1.  **Implementation Testing:** `expect(component.state().foo).toBe('bar')`. (Use `screen.getByText` or `userEvent`).
2.  **Snapshot Abuse:** No massive full-page snapshots. They are brittle and ignored during review.
3.  **Sleeps:** `await new Promise(r => setTimeout(r, 1000))`. USE `waitFor` or `findBy`.
4.  **Conditionals:** No `if` statements inside tests. Tests must be linear flows.
