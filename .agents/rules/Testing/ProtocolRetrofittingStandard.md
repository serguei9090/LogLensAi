# Protocol: Retrofitting BDD/TDD (v2)

## 1. Core Principles (Invariants)
*   **Lock-In First:** Document "Reality" (Current Behavior) before improving it.
*   **No Logic Change:** Do not refactor code in Phase 1. Only add `data-testid` attributes.
*   **Green Before Red:** The test MUST pass against the legacy code (proving it captures the current state) before you write new features.

## 2. Workflow (The Retrofit Cycle)
1.  **Analyze:** Read legacy component code.
2.  **Reverse Engineer:** Write `.feature` file describing current behavior (even bugs).
3.  **Harden:** Add `data-testid` to the legacy component to make it testable to avoid reliance on brittle class names.
4.  **Lock:** Write Glue Code (`steps.tsx`) and ensure it Passes Green.
5.  **Refactor (Optional):** NOW you are safe to improve logic.

## 3. Directory & Naming
*   **Attributes:** `data-testid="section-name"`.
*   **Tests:** `tests/legacy/[feature].feature`.

## 4. Forbidden Patterns (Strict)
1.  **Improvements in Phase 1:** "I fixed a bug while writing the test." **NO.** Document the bug first.
2.  **Brittle Selectors:** `document.querySelector('.div > span')`. Use `getByTestId`.
3.  **Mocking Everything:** Mocking internal state instead of testing interactions.

## 5. Golden Example (Hardening)
```tsx
// BEFORE (Untestable Legacy)
<button className="btn-primary" onClick={submit}>
  <span>Submit</span>
</button>

// AFTER (Hardened)
<button 
  data-testid="submit-payment-btn" // Added ID
  className="btn-primary" 
  onClick={submit}
>
  <span>Submit</span>
</button>
```
