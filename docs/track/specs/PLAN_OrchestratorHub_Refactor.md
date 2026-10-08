# Refactoring Plan: Decompose `OrchestratorHub.tsx` (728 lines)

## 1. Context & Motivation
- **File**: `src/components/organisms/OrchestratorHub.tsx` (728 lines)
- **Goal**: Decompose into a structured feature module under `src/components/organisms/orchestrator/` per the 300–400 line UI ceiling and Atomic Design standards.
- Provide a clean backward-compatibility re-export proxy in `src/components/organisms/OrchestratorHub.tsx`.
- **Verification Gate**: `bun run build` must succeed with 0 errors.

---

## 2. Target Directory Structure (`src/components/organisms/orchestrator/`)

```
src/components/organisms/orchestrator/
├── types.ts                    (~35 lines)  - FusionSourceConfig, OrchestratorHubProps, DiscoveryTemplate, View mode
├── components/
│   ├── StrategyCard.tsx        (~30 lines)  - Operation strategy card button
│   ├── OrchestratorHeader.tsx  (~35 lines)  - Drawer header with view label & close button
│   ├── OrchestratorPickerView.tsx (~140 lines) - Command center visualizers, cognitive state, clustering switches, operations
│   ├── FusionFormView.tsx      (~120 lines) - Fusion stream list, template dropdown, parser settings
│   ├── TimeAlignmentView.tsx   (~80 lines)  - Multi-source temporal shift offsets & sync triggers
│   └── AiContextView.tsx       (~40 lines)  - Workspace architecture constraints & knowledge prompt editor
├── OrchestratorHub.tsx         (~200 lines) - Slim drawer shell, state initialization, sidecar effects, portal wrapper
└── index.ts                    (~10 lines)  - Barrel exports

src/components/organisms/OrchestratorHub.tsx (~5 lines) - Re-export proxy
```

---

## 3. Sub-Component Breakdown
1. **`types.ts`**:
   - `FusionSourceConfig`, `DiscoveryTemplate`, `OrchestratorHubProps`, `OrchestratorView` (`"picker" | "fusion-form" | "ai-context-form" | "time-alignment-form"`).
2. **`components/StrategyCard.tsx`**:
   - Reusable option card for operations (Log Fusion, Temporal Sync).
3. **`components/OrchestratorHeader.tsx`**:
   - Top banner displaying active sub-view title and close button.
4. **`components/OrchestratorPickerView.tsx`**:
   - Main dashboard inside the drawer:
     - Visualizers: Log Distribution & Anomaly Radar switches.
     - Intelligence: Knowledge Base context summary and edit trigger.
     - Engine Performance: Clustering enable switch (Drain3).
     - Engine: Core Parser settings button.
     - Operations: Strategy cards leading to Fusion & Temporal subviews.
5. **`components/FusionFormView.tsx`**:
   - Input for fusion stream name, multi-source toggle list, discovery templates dropdown, parser modal trigger.
6. **`components/TimeAlignmentView.tsx`**:
   - Per-source temporal offsets display and "Sync" trigger for `TimeShiftModal`.
7. **`components/AiContextView.tsx`**:
   - Full-height textarea for global architecture knowledge base context.
8. **`OrchestratorHub.tsx`**:
   - Manages state (`view`, `configs`, `temporalOffsets`, `templates`), portal rendering to `document.body`, modal dialogs (`CustomParserModal`, `TimeShiftModal`), and drawer footer actions.

---

## 4. Verification Plan
1. Create all modular files in `src/components/organisms/orchestrator/`.
2. Update `src/components/organisms/OrchestratorHub.tsx` to proxy to the new module.
3. Run `bun run build`.
4. Update `docs/track/CodeDebt_Monolith_Refactor.md`.
