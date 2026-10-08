# Specification & Plan: Refactoring `LayaSettingsPanel.tsx`

## 1. Problem Statement
`src/components/organisms/LayaSettingsPanel.tsx` is **1,231 lines long**, violating the **<300–400 line** component limit. It bundles:
- Hardware selection cards (CPU/GPU) & Top banner
- Model weights download progress & local cache status
- Tab 1: Visual Rule List & cards
- Tab 2: JSON Code Editor & real-time syntax validator
- Tab 3: Checkpoints & rollback history list
- Tab 4: Interactive Test Playground with probability distribution bars
- Modals:
  - Add/Edit Rule modal (`Dialog`)
  - Commit JSON Checkpoint modal (`Dialog`)
  - Rollback confirmation modal (`Dialog`)
  - Laya architecture & primitives documentation modal (`Dialog`)

## 2. Target Architecture (`src/components/organisms/laya-settings/`)

```text
src/components/organisms/laya-settings/
├── components/
│   ├── LayaHeaderBanner.tsx      (~60 lines)  - Banner with Zap icon, ModernBERT badge, guide button, enabled switch
│   ├── HardwareAcceleration.tsx   (~95 lines)  - CPU Mode vs GPU directML/CUDA mode cards
│   ├── ModelWeightsStatus.tsx    (~95 lines)  - Local weights ready badge, download progress bar, error state
│   ├── VisualRulesTab.tsx        (~140 lines) - Visual rules list, rule cards (choice, score, noul), edit/delete buttons
│   ├── JsonEditorTab.tsx         (~50 lines)  - JSON textarea editor, validation checkmark
│   ├── CheckpointsTab.tsx        (~65 lines)  - Checkpoint cards with active pill and rollback trigger
│   └── TestPlaygroundTab.tsx     (~130 lines) - Input state textarea, rule selector, prediction result & prob bars
├── modals/
│   ├── AddEditRuleModal.tsx      (~120 lines) - Dialog for creating or modifying a rule
│   ├── SaveCheckpointModal.tsx   (~65 lines)  - Dialog for naming and authoring a checkpoint commit
│   ├── RollbackModal.tsx         (~50 lines)  - Dialog for confirming rollback
│   └── LayaGuideModal.tsx        (~115 lines) - Dialog explaining System 1 decision engine & 3 primitives
├── LayaSettingsPanel.tsx         (~220 lines) - Slim coordinator shell managing state & store dispatches
└── index.ts                     (~15 lines)  - Public re-exports
```

## 3. Migration Plan (Option B: Clean Feature Directory)
1. Create all subcomponents and modals under `src/components/organisms/laya-settings/`.
2. Assemble `LayaSettingsPanel.tsx` coordinator shell (<250 lines).
3. Create `src/components/organisms/laya-settings/index.ts`.
4. Update caller in `src/components/organisms/settings/sections/LayaSettingsSection.tsx` to import from `@/components/organisms/laya-settings`.
5. Remove old `src/components/organisms/LayaSettingsPanel.tsx`.
6. Run `bun run build` to verify 0 errors.
7. Update `docs/track/CodeDebt_Monolith_Refactor.md`.
