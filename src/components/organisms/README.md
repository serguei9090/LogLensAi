# Organisms

## Overview
Compatibility barrel re-exports bridging legacy `@/components/organisms/*` imports to `@/features/*` implementations, alongside co-located complex organism modules (`a2ui`, `ai-sidebar`, `custom-parser`, `import-modal`, `laya-settings`, `log-table`, `orchestrator`, `settings`).

## Interface
- `[AIHistorySearchModal.tsx:export *]` - Re-exports all symbols from `@/features/investigation/AIHistorySearchModal`.
- `[ColumnManagerSidebar.tsx:export *]` - Re-exports all symbols from `@/features/investigation/ColumnManagerSidebar`.
- `[CommandPalette.tsx:export *]` - Re-exports all symbols from `@/features/shell/CommandPalette`.
- `[DashboardCharts.tsx:export *]` - Re-exports all symbols from `@/features/dashboard/DashboardCharts`.
- `[DiagnosticSidebar.tsx:export *]` - Re-exports all symbols from `@/features/shell/DiagnosticSidebar`.
- `[ExplorerView.tsx:export *]` - Re-exports all symbols from `@/features/investigation/ExplorerView`.
- `[FacetSidebar.tsx:export *]` - Re-exports all symbols from `@/features/investigation/FacetSidebar`.
- `[FusionConfigEngine.tsx:FusionConfigEngine]` - Re-exports all symbols and explicit `FusionConfigEngine` from `@/features/orchestrator/FusionConfigEngine`.
- `[ImportFeedModal.tsx:export *]` - Re-exports all symbols from `@/features/investigation/ImportFeedModal`.
- `[LoadTemplateModal.tsx:export *]` - Re-exports all symbols from `@/features/investigation/LoadTemplateModal`.
- `[LogDistributionWidget.tsx:LogDistributionWidget]` - Re-exports named and default `LogDistributionWidget` from `@/features/investigation/LogDistributionWidget`.
- `[LogToolbar.tsx:export *]` - Re-exports all symbols from `@/features/investigation/LogToolbar`.
- `[OrchestratorHub.tsx:export *]` - Re-exports all symbols from `@/features/orchestrator/OrchestratorHub`.
- `[SaveTemplateModal.tsx:export *]` - Re-exports all symbols from `@/features/investigation/SaveTemplateModal`.
- `[SettingsPanel.tsx:SettingsPanel]` - Re-exports `SettingsPanel` (named and default) and type `SectionId` from `@/features/settings/SettingsPanel`.
- `[Sidebar.tsx:export *]` - Re-exports all symbols from `@/features/shell/Sidebar`.
- `[SidecarStartupGateway.tsx:export *]` - Re-exports all symbols from `@/features/shell/SidecarStartupGateway`.
- `[SystemDiagnosticConsole.tsx:export *]` - Re-exports all symbols from `@/features/shell/SystemDiagnosticConsole`.
- `[TimeShiftModal.tsx:export *]` - Re-exports all symbols from `@/features/orchestrator/TimeShiftModal`.
- `[VirtualLogTable.tsx:export *]` - Re-exports all symbols from `@/features/investigation/VirtualLogTable`.
- `[WorkspaceEngineSettings.tsx:export *]` - Re-exports all symbols from `@/features/settings/WorkspaceEngineSettings`.
- Child contracts: [a2ui](./a2ui/README.md), [ai-sidebar](./ai-sidebar/README.md), [custom-parser](./custom-parser/README.md), [import-modal](./import-modal/README.md), [laya-settings](./laya-settings/README.md), [log-table](./log-table/README.md), [orchestrator](./orchestrator/README.md), [settings](./settings/README.md).

## Invariants
- `None`

## Side Effects
- `None`

## Verification
- Run: `bun test`
