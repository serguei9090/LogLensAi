# Refactoring Plan: `src/components/organisms/CustomParserModal.tsx`

> **Target**: `src/components/organisms/CustomParserModal.tsx` (591 lines)  
> **Goal**: Modularize into `src/components/organisms/custom-parser/` with dedicated components for sample view, regex configuration, preview grid, and floating selection toolbar. Clean architecture with zero backward proxies.

---

## 1. Problem & Architecture Overview

`CustomParserModal.tsx` mixes 4 responsibilities:
1. **Types & Regex Converter Utils**: Python to JS regex parser, mapping serialization, segment highlights logic.
2. **Sample Viewer**: Log lines list with highlight spans and mouse-up selection event listener.
3. **Extraction & Preview Panel**: Regex textarea, preview entries list, info tooltips, and save actions.
4. **Floating Selection Toolbar**: Floating overlay positioning and quick Map buttons.

---

## 2. Target File Structure (`src/components/organisms/custom-parser/`)

```text
src/components/organisms/custom-parser/
├── types.ts              (~25 lines)  - ParserMapping, ParserConfig, CustomParserModalProps, ActiveSelection
├── utils.ts              (~65 lines)  - Regex mapping converters, preview matcher & highlight segment builder
├── ParserHeader.tsx      (~40 lines)  - Modal header with title and close button
├── SampleViewer.tsx      (~85 lines)  - Log lines stream with highlight spans & selection listener
├── ExtractionPanel.tsx   (~115 lines) - Regex input, mapping controls, preview list & save buttons
├── SelectionToolbar.tsx  (~45 lines)  - Floating tooltip to map text to Timestamp or Severity
└── CustomParserModal.tsx (~100 lines) - Coordinator shell assembling subcomponents
```

Update callers:
- `src/components/organisms/FusionConfigEngine.tsx`
- `src/components/organisms/orchestrator/OrchestratorHub.tsx`
- `src/components/pages/investigation/components/InvestigationModals.tsx`
to import cleanly from `@/components/organisms/custom-parser`.

---

## 3. Verification Plan

1. Verify TypeScript compilation: `bun run build`.
2. Confirm all callers resolve cleanly.
