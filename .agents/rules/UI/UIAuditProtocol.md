---
trigger: model_decision
description: Mandatory Visual Parity Audit protocol for the @ui-auditor and @ui-designer.
---
# UI/UX Audit Protocol (Visual Parity)

To ensure that implementations remain 100% faithful to the **`DESIGN.md`** spec, the following audit steps MUST be performed after any UI implementation and before passing QA.

## 1. Token Verification (The "Zero-Hardcode" Check)
The auditor MUST scan the implementation (CSS/TSX) for hardcoded visual values.
- **Rule**: Every color, spacing value, border-radius, and font-size MUST reference a variable from the `DESIGN.md` token set.
- **Violation**: `bg-[#ff0000]` or `p-4` (if `p-4` is not in the design rhythm).
- **Remedy**: Replace with `var(--primary)` or `p-[var(--spacing-md)]`.

## 2. Component Anatomy Check
Compare the implemented React structure against the **Atomic Design** hierarchy in `DESIGN.md`.
- **Atoms**: Verify they have no external margins and are presentationally pure.
- **Molecules**: Verify they correctly compose Atoms without leaking business logic.
- **Organisms**: Verify layout integrity and state-only handling.

## 3. Motion & Interaction Audit
Utilize the `animate` and `delight` skill benchmarks to verify transitions.
- **Rule**: Every transition MUST match the semantic durations defined in `MotionSystemStandard.md` (Instant, Fast, Deliberate).
- **Smoothness**: Verify no "jank" (animations on non-composite properties like `width/height`).

## 4. Accessibility & UX Hygiene
Perform a technical sweep for common UX defects:
- **Hydration**: Verify no nested interactive elements (`<a>` inside `<button>`).
- **Focus**: Ensure all interactive elements have visible focus states.
- **Form Safety**: Verify that **strictly forbidden** native elements (like raw `<select>`) are replaced with themed `shadcn` equivalents.

## 5. Responsive & Dark Mode Parity
Test the UI across breakpoints and theme shifts.
- **Dark Mode**: Verify that colors are fetched from the `dark` theme tokens in `DESIGN.md`.
- **Breakpoints**: Verify that layout shifts follow the grid system defined in the spec.

## 6. Audit Verdict
The `@ui-auditor` MUST provide a clear verdict:
- **✅ PASS**: Implementation is 100% aligned with `DESIGN.md`.
- **❌ REJECT**: List specific deviations and token violations. Implementation MUST be returned to `@frontend` for fixing.
