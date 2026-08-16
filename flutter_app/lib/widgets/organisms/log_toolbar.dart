/// Dart port of `src/components/organisms/LogToolbar.tsx`.
///
/// Sticky top toolbar for the Investigation page: connectivity status,
/// import/export/orchestrate actions, the live-tail switch, the centered
/// search bar, the time-range/filter/highlight controls, a column-visibility
/// menu, a template-actions menu, and the AI sidebar toggle.
///
/// Deviations from the React source:
///  - The React component accepts `sources`/`activeSourceId`/
///    `tailingSourceIds`/`onSelectSource`/`onRemoveSource`/`onEditFusion`/
///    `onRenameSource` props but (as of the current `src/` snapshot this was
///    ported from) never actually renders a `WorkspaceTabs` row with them --
///    they're accepted and unused (vestigial from an earlier refactor). This
///    port *does* render [WorkspaceTabs] as a second row beneath the main
///    toolbar row whenever `sources` is non-empty, per this migration
///    batch's explicit brief ("`WorkspaceTabs` molecule for source tabs").
///  - `SaveTemplateModal`/`LoadTemplateModal` (batch-2 organisms, not yet
///    built as of this pass) are not imported. The "Save as Template" /
///    "Load Template" template-menu entries instead invoke optional
///    [onSaveTemplate]/[onLoadTemplate] callbacks so a later integration
///    pass can open the real modals without changing this widget's API.
///  - The React version wraps the whole bar in `overflow-x-auto` so it can
///    horizontally scroll on narrow viewports, which conflicts with using
///    `Expanded` spacers to truly center the search bar (a scrollable `Row`
///    can't contain `Expanded` children). This port keeps the centering
///    behavior (matches the design intent more closely on desktop, which is
///    this app's only target) and drops the horizontal-scroll fallback.
///  - Column visibility and template actions use [PopupMenuButton] (closes
///    per selection) rather than the React `DropdownMenu` (stays open across
///    multiple toggles) -- Flutter's stock popup menu doesn't support a
///    "stay open" mode without a custom overlay; re-opening for each toggle
///    is a minor UX-only difference.
library;

import "package:flutter/material.dart";
import "package:flutter_riverpod/flutter_riverpod.dart";

import "../../models/log_entry.dart";
import "../../models/workspace.dart";
import "../../providers/ai_provider.dart";
import "../../providers/investigation_provider.dart" as inv;
import "../../providers/ui_provider.dart";
import "../../theme/app_theme.dart";
import "../atoms/status_dot.dart";
import "../atoms/tail_switch.dart";
import "../molecules/filter_builder.dart";
import "../molecules/highlight_builder.dart";
import "../molecules/search_bar.dart";
import "../molecules/time_range_picker.dart" as trp;
import "../molecules/workspace_tabs.dart";

class LogToolbar extends ConsumerWidget {
  const LogToolbar({
    super.key,
    required this.searchQuery,
    required this.onSearch,
    required this.activeFilters,
    required this.onFilterChange,
    required this.activeHighlights,
    required this.onHighlightChange,
    required this.isTailing,
    required this.onTailToggle,
    required this.status,
    required this.onImportOpen,
    required this.onOrchestrateOpen,
    required this.onExport,
    this.sources = const [],
    this.activeSourceId,
    this.tailingSourceIds = const {},
    this.onSelectSource,
    this.onRemoveSource,
    this.onEditFusion,
    this.onRenameSource,
    this.activeWorkspaceId = "",
    this.onEngineSettingsOpen,
    this.onSaveTemplate,
    this.onLoadTemplate,
  });

  final String searchQuery;
  final ValueChanged<String> onSearch;
  final List<LogFilter> activeFilters;
  final ValueChanged<List<LogFilter>> onFilterChange;
  final List<HighlightRule> activeHighlights;
  final ValueChanged<List<HighlightRule>> onHighlightChange;
  final bool isTailing;
  final ValueChanged<bool> onTailToggle;

  /// Sidecar connectivity status, mirrors the React `status: boolean` prop
  /// fed into [StatusDot].
  final bool status;

  final VoidCallback onImportOpen;
  final VoidCallback onOrchestrateOpen;
  final VoidCallback onExport;

  final List<LogSource> sources;
  final String? activeSourceId;
  final Set<String> tailingSourceIds;
  final ValueChanged<String?>? onSelectSource;
  final ValueChanged<String>? onRemoveSource;
  final ValueChanged<String>? onEditFusion;
  final void Function(String workspaceId, String sourceId, String name)? onRenameSource;
  final String activeWorkspaceId;

  final VoidCallback? onEngineSettingsOpen;
  final VoidCallback? onSaveTemplate;
  final VoidCallback? onLoadTemplate;

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final hasActiveSource = activeSourceId != null;
    final investigation = ref.watch(inv.investigationProvider);
    final investigationNotifier = ref.read(inv.investigationProvider.notifier);
    final aiState = ref.watch(aiProvider);
    final aiNotifier = ref.read(aiProvider.notifier);
    final uiState = ref.watch(uiProvider);
    final uiNotifier = ref.read(uiProvider.notifier);

    final tr = investigation.timeRange;
    final bounds = investigation.timeRangeBounds;
    final isFiltered =
        (tr.start.isNotEmpty && tr.start != bounds.start) ||
        (tr.end.isNotEmpty && tr.end != bounds.end);

    return Container(
      decoration: const BoxDecoration(
        color: AppColors.bgApp,
        border: Border(bottom: BorderSide(color: AppColors.borderSubtle)),
      ),
      child: Column(
        mainAxisSize: MainAxisSize.min,
        children: [
          Padding(
            padding: const EdgeInsets.symmetric(horizontal: AppSpacing.md, vertical: 10),
            child: Row(
              children: [
                StatusDot(active: status),
                const SizedBox(width: AppSpacing.sm),
                _ImportButton(onPressed: onImportOpen),
                if (hasActiveSource) ...[
                  const SizedBox(width: AppSpacing.sm),
                  _ToolbarButton(
                    icon: Icons.download,
                    label: "Export",
                    onPressed: onExport,
                  ),
                  const SizedBox(width: AppSpacing.sm),
                  _OrchestrateButton(onPressed: onOrchestrateOpen),
                  const SizedBox(width: AppSpacing.sm),
                  _SquareIconButton(
                    icon: Icons.view_column_outlined,
                    tooltip: uiState.facetSidebarCollapsed ? "Show Facets" : "Hide Facets",
                    active: !uiState.facetSidebarCollapsed,
                    onPressed: uiNotifier.toggleFacetSidebar,
                  ),
                  const SizedBox(width: 4),
                  _SquareIconButton(
                    icon: Icons.dashboard_customize_outlined,
                    tooltip: uiState.columnManagerCollapsed
                        ? "Show Column Manager"
                        : "Hide Column Manager",
                    active: !uiState.columnManagerCollapsed,
                    onPressed: uiNotifier.toggleColumnManager,
                  ),
                  const _VDivider(),
                  TailSwitch(checked: isTailing, onChanged: onTailToggle),
                  Expanded(
                    child: Center(
                      child: ConstrainedBox(
                        constraints: const BoxConstraints(maxWidth: 384),
                        child: LogSearchBar(value: searchQuery, onChange: onSearch),
                      ),
                    ),
                  ),
                  if (isFiltered) ...[
                    OutlinedButton(
                      onPressed: investigationNotifier.resetTimeRangeToAllTime,
                      style: OutlinedButton.styleFrom(
                        foregroundColor: AppColors.primary,
                        side: BorderSide(color: AppColors.primary.withValues(alpha: 0.2)),
                        minimumSize: const Size(0, 28),
                        padding: const EdgeInsets.symmetric(horizontal: AppSpacing.sm),
                      ),
                      child: const Text("Reset Time", style: TextStyle(fontSize: 11)),
                    ),
                    const SizedBox(width: AppSpacing.sm),
                  ],
                  trp.TimeRangePicker(
                    value: trp.TimeRange(start: tr.start, end: tr.end, label: tr.label),
                    onChange: (next) => investigationNotifier.setTimeRange(
                      inv.TimeRange(start: next.start, end: next.end, label: next.label),
                    ),
                  ),
                  const _VDivider(),
                  FilterBuilder(filters: activeFilters, onChange: onFilterChange),
                  const SizedBox(width: AppSpacing.xs),
                  HighlightBuilder(highlights: activeHighlights, onChange: onHighlightChange),
                  _ColumnsMenu(
                    visibleColumns: uiState.visibleColumns,
                    onToggle: uiNotifier.toggleColumnVisibility,
                  ),
                  _TemplateMenu(
                    onSaveTemplate: onSaveTemplate,
                    onLoadTemplate: onLoadTemplate,
                    onEngineSettingsOpen: onEngineSettingsOpen,
                  ),
                  const _VDivider(),
                  _SquareIconButton(
                    icon: Icons.auto_awesome,
                    tooltip: aiState.isSidebarOpen ? "Close AI Assistant" : "Open AI Assistant",
                    active: aiState.isSidebarOpen,
                    onPressed: () => aiNotifier.setSidebarOpen(!aiState.isSidebarOpen),
                  ),
                ] else
                  const Spacer(),
              ],
            ),
          ),
          if (sources.isNotEmpty)
            Padding(
              padding: const EdgeInsets.only(left: AppSpacing.md, right: AppSpacing.md, bottom: 4),
              child: WorkspaceTabs(
                sources: sources,
                activeSourceId: activeSourceId,
                tailingSourceIds: tailingSourceIds,
                activeWorkspaceId: activeWorkspaceId,
                onSelectSource: onSelectSource ?? (_) {},
                onRemoveSource: onRemoveSource,
                onEditFusion: onEditFusion,
                onRenameSource: onRenameSource,
              ),
            ),
        ],
      ),
    );
  }
}

class _VDivider extends StatelessWidget {
  const _VDivider();

  @override
  Widget build(BuildContext context) {
    return Container(
      width: 1,
      height: 20,
      margin: const EdgeInsets.symmetric(horizontal: AppSpacing.sm),
      color: AppColors.border,
    );
  }
}

class _ImportButton extends StatelessWidget {
  const _ImportButton({required this.onPressed});
  final VoidCallback onPressed;

  @override
  Widget build(BuildContext context) {
    return ElevatedButton.icon(
      onPressed: onPressed,
      icon: const Icon(Icons.upload, size: 14),
      label: const Text("Import"),
      style: ElevatedButton.styleFrom(
        textStyle: const TextStyle(fontSize: 12, fontWeight: FontWeight.w700),
        padding: const EdgeInsets.symmetric(horizontal: AppSpacing.sm, vertical: 6),
        minimumSize: const Size(0, 32),
      ),
    );
  }
}

class _ToolbarButton extends StatelessWidget {
  const _ToolbarButton({required this.icon, required this.label, required this.onPressed});
  final IconData icon;
  final String label;
  final VoidCallback onPressed;

  @override
  Widget build(BuildContext context) {
    return OutlinedButton.icon(
      onPressed: onPressed,
      icon: Icon(icon, size: 14),
      label: Text(label),
      style: OutlinedButton.styleFrom(
        textStyle: const TextStyle(fontSize: 12, fontWeight: FontWeight.w700),
        padding: const EdgeInsets.symmetric(horizontal: AppSpacing.sm, vertical: 6),
        minimumSize: const Size(0, 32),
      ),
    );
  }
}

class _OrchestrateButton extends StatelessWidget {
  const _OrchestrateButton({required this.onPressed});
  final VoidCallback onPressed;

  @override
  Widget build(BuildContext context) {
    return OutlinedButton.icon(
      onPressed: onPressed,
      icon: const Icon(Icons.memory, size: 14),
      label: const Text("Orchestrate"),
      style: OutlinedButton.styleFrom(
        foregroundColor: AppColors.accentViolet,
        backgroundColor: AppColors.accentViolet.withValues(alpha: 0.1),
        side: BorderSide(color: AppColors.accentViolet.withValues(alpha: 0.2)),
        textStyle: const TextStyle(fontSize: 12, fontWeight: FontWeight.w700),
        padding: const EdgeInsets.symmetric(horizontal: AppSpacing.sm, vertical: 6),
        minimumSize: const Size(0, 32),
      ),
    );
  }
}

class _SquareIconButton extends StatelessWidget {
  const _SquareIconButton({
    required this.icon,
    required this.tooltip,
    required this.active,
    required this.onPressed,
  });

  final IconData icon;
  final String tooltip;
  final bool active;
  final VoidCallback onPressed;

  @override
  Widget build(BuildContext context) {
    return Tooltip(
      message: tooltip,
      child: InkWell(
        onTap: onPressed,
        borderRadius: BorderRadius.circular(AppRadius.md),
        child: Container(
          width: 32,
          height: 32,
          decoration: BoxDecoration(
            color: active ? AppColors.primary.withValues(alpha: 0.1) : AppColors.bgSurfaceBright.withValues(alpha: 0.5),
            border: Border.all(color: active ? AppColors.primary.withValues(alpha: 0.2) : AppColors.borderSubtle),
            borderRadius: BorderRadius.circular(AppRadius.md),
          ),
          child: Icon(icon, size: 16, color: active ? AppColors.primary : AppColors.textMuted),
        ),
      ),
    );
  }
}

class _ColumnsMenu extends StatelessWidget {
  const _ColumnsMenu({required this.visibleColumns, required this.onToggle});

  final Map<String, bool> visibleColumns;
  final ValueChanged<String> onToggle;

  @override
  Widget build(BuildContext context) {
    return PopupMenuButton<String>(
      tooltip: "Toggle Columns",
      icon: const Icon(Icons.view_column_outlined, size: 18, color: AppColors.textMuted),
      color: AppColors.bgSurface,
      itemBuilder: (context) => [
        for (final colName in visibleColumns.keys)
          PopupMenuItem<String>(
            value: colName,
            child: Row(
              mainAxisAlignment: MainAxisAlignment.spaceBetween,
              children: [
                Text(colName.replaceAll("_", " "), style: const TextStyle(fontSize: 12)),
                Icon(
                  (visibleColumns[colName] ?? false) ? Icons.visibility : Icons.visibility_off,
                  size: 14,
                  color: (visibleColumns[colName] ?? false) ? AppColors.primary : AppColors.textMuted,
                ),
              ],
            ),
          ),
      ],
      onSelected: onToggle,
    );
  }
}

class _TemplateMenu extends StatelessWidget {
  const _TemplateMenu({this.onSaveTemplate, this.onLoadTemplate, this.onEngineSettingsOpen});

  final VoidCallback? onSaveTemplate;
  final VoidCallback? onLoadTemplate;
  final VoidCallback? onEngineSettingsOpen;

  @override
  Widget build(BuildContext context) {
    return PopupMenuButton<String>(
      tooltip: "Template Actions",
      icon: const Icon(Icons.dashboard_customize_outlined, size: 18, color: AppColors.textMuted),
      color: AppColors.bgSurface,
      itemBuilder: (context) => [
        const PopupMenuItem(value: "save", child: Text("Save as Template", style: TextStyle(fontSize: 12))),
        const PopupMenuItem(value: "load", child: Text("Load Template", style: TextStyle(fontSize: 12))),
        if (onEngineSettingsOpen != null)
          const PopupMenuItem(value: "engine", child: Text("Engine Settings", style: TextStyle(fontSize: 12))),
      ],
      onSelected: (value) {
        switch (value) {
          case "save":
            onSaveTemplate?.call();
          case "load":
            onLoadTemplate?.call();
          case "engine":
            onEngineSettingsOpen?.call();
        }
      },
    );
  }
}
