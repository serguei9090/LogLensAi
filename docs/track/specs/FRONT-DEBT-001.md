Assume Role: Product Manager (@pm)

# FRONT-DEBT-001: Hex Values Audit & Clean-up

## 🎯 Goal
Ensure that `src/components/pages/DashboardPage.tsx` and `src/components/organisms/FusionConfigEngine.tsx` do not contain hardcoded hexadecimal/rgba color values, in compliance with `DESIGN.md`.

## 🛠️ Requirements
- Audit both files for hardcoded hex colors (e.g. `#22C55E`, `#10B981`) and rgba colors (e.g. `rgba(34, 197, 94, 0.3)`).
- Replace them with semantic CSS custom properties defined in `styles/globals.css` (e.g. `var(--primary)`, `var(--primary-glow)`).

## 🔍 Audit & Verification
- `DashboardPage.tsx`: Verified. Utilizes `color-mix(in srgb, var(--primary) ..., transparent)` for dynamic opacity rather than hardcoded hex/rgba.
- `FusionConfigEngine.tsx`: Verified. Utilizes `shadow-[0_0_10px_var(--primary-glow)]` for accents rather than raw rgba.
- Both files are compliant with theme-variable spacing, typography, and color rules. No edits required.
