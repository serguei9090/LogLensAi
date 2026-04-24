# FEAT-ORK-001: Orchestrator Hub

## Status: IMPLEMENTING

## Summary
Replace the "Fusion" tab in WorkspaceTabs with a persistent **"Orchestrate"** button in the LogToolbar. The Orchestrate button opens a **slide-in drawer panel** (OrchestratorHub) that:
1. Shows a list of available orchestration **strategy types** (e.g. "Fusion").
2. Lets the user create a named orchestration session (filling in title + source config).
3. Saves the session as an **orchestration item** and adds it as a workspace tab.
4. Allows editing an existing orchestration item.

## User Flow
```
[Toolbar] → [Orchestrate ▶] click
  → OrchestratorHub drawer slides in (RIGHT side panel, not modal)
    → Strategy Picker: [⚡ Fusion]  [+ future]
    → Click "Fusion":
        → FusionForm shows inline:
            - Title Input (the name for the new tab)
            - Log Source list + enable toggle
            - Per-source Timezone picker
            - Per-source Parser button → opens CustomParserModal
        → [Deploy Fusion] → creates an orchestration item
  → Drawer closes, new "fusion:MyTitle" tab appears in WorkspaceTabs (editable)
  → Clicking the tab shows the fused log view
  → Clicking "Edit" on the tab re-opens OrchestratorHub pre-filled
```

## Architecture
### Removed
- `Fusion` tab from `WorkspaceTabs.tsx` (the hard-coded `null` source sentinel)
- `showFusionConfig` / `onToggleFusionConfig` props from `InvestigationLayout` + `LogToolbar`

### New/Modified Components
| Component | Layer | Change |
|---|---|---|
| `OrchestratorHub.tsx` | Organism | NEW — slide-in side drawer with strategy picker + form |
| `WorkspaceTabs.tsx` | Molecule | Remove Fusion tab; add edit icon on fusion-type source tabs |
| `LogToolbar.tsx` | Organism | Replace conditional Orchestrate with a **permanent** Orchestrate button |
| `InvestigationLayout.tsx` | Template | Remove Fusion config props; add `onOrchestrateOpen` |
| `InvestigationPage.tsx` | Page | Wire the new hub state; manage fusion items in `workspaceStore` |
| `FusionConfigEngine.tsx` | Organism | Refactor as `FusionForm` sub-component of OrchestratorHub (no longer a standalone page) |

### State Changes
- `workspaceStore`: orchestration items stored as a new source `type: "fusion"`, with a `fusionConfig` JSON blob.
- No new sidecar methods needed; `update_fusion_config` / `get_fusion_config` still used.

## Acceptance Criteria
- [ ] "Fusion" tab is removed from `WorkspaceTabs`
- [ ] "Orchestrate" button is always visible in `LogToolbar`
- [ ] OrchestratorHub opens as a right-side drawer when Orchestrate is clicked
- [ ] User can create a Fusion with a custom title
- [ ] Fusion appears as a named tab in WorkspaceTabs
- [ ] Clicking the tab loads the fused log view
- [ ] User can click "Edit" on a fusion tab to reopen OrchestratorHub pre-filled
