# Components (`src/components`)

## Overview
UI component tree for the LogLensAi frontend, grouping accessible base primitives (`ui`), shared cross-domain components (`common`), Atomic Design compatibility re-export layers (`atoms`, `molecules`, `organisms`, `pages`, `templates`), and co-located complex organisms and page implementations.

## Subdirectories & Boundaries
- `atoms`: [./atoms/README.md](./atoms/README.md) - Compatibility barrel re-exporting low-level UI atom components from `@/components/common/*`.
- `common`: [./common/README.md](./common/README.md) - Canonical shared UI components (filters, facets, highlight builders, hierarchy tree, ECharts wrapper, tail switch, workspace tabs, and `time-picker`).
- `molecules`: [./molecules/README.md](./molecules/README.md) - Compatibility barrel re-exporting composite molecule components from `@/components/common/*`, plus a nested `time-picker` package.
- `organisms`: [./organisms/README.md](./organisms/README.md) - Compatibility barrel re-exporting `@/features/*` organisms alongside co-located `a2ui`, `ai-sidebar`, `custom-parser`, `import-modal`, `laya-settings`, `log-table`, `orchestrator`, and `settings` modules.
- `pages`: [./pages/README.md](./pages/README.md) - Compatibility barrel re-exporting `@/features/*` page components alongside co-located `dashboard` and `investigation` page packages.
- `templates`: [./templates/README.md](./templates/README.md) - Compatibility barrel re-exporting `AppLayout` and `InvestigationLayout` from `@/features/*`.
- `ui`: [./ui/README.md](./ui/README.md) - Accessible design-system primitive wrappers built on `@base-ui/react`, `react-day-picker`, `sonner`, and `class-variance-authority`.
