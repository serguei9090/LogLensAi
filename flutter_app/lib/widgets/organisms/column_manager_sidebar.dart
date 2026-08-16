/// Dart port of `src/components/organisms/ColumnManagerSidebar.tsx`.
///
/// Fixed-width (256px) collapsible panel for reordering table columns and
/// toggling their visibility, with an "Add Column" affordance that opens
/// [AddColumnModal].
///
/// Deviation from the React source: the React version uses `dnd-kit`
/// (`DndContext`/`SortableContext`/`useSortable`) for drag-to-reorder. Per
/// this migration pass's guidance, this port uses Flutter's built-in
/// [ReorderableListView] instead of hand-rolling a dnd-kit equivalent --
/// visually and behaviorally equivalent (drag a row by its grip handle to
/// reorder) without a third-party drag-and-drop dependency.
library;

import "package:flutter/material.dart";
import "package:flutter_riverpod/flutter_riverpod.dart";

import "../../models/ui_column.dart";
import "../../providers/ui_provider.dart";
import "../../providers/workspace_provider.dart";
import "../../theme/app_theme.dart";
import "../molecules/add_column_modal.dart";

/// Static metadata for the built-in (non-custom) column ids.
const Map<String, String> _kBuiltInLabels = {
  "id": "ID",
  "timestamp": "Timestamp",
  "ingest_timestamp": "Ingest Time",
  "level": "Level",
  "message": "Message",
  "cluster_id": "Cluster",
  "actions": "Actions",
};

class _ColumnRowData {
  const _ColumnRowData({
    required this.id,
    required this.label,
    required this.visible,
    required this.badge,
    this.onDelete,
  });

  final String id;
  final String label;
  final bool visible;

  /// "built-in" | "auto" | "user" -- null means not a recognized column
  /// (filtered out before rendering, mirrors the React `getColumnDetails`
  /// returning `null`).
  final String badge;
  final VoidCallback? onDelete;
}

class ColumnManagerSidebar extends ConsumerWidget {
  const ColumnManagerSidebar({super.key});

  static const double width = 256;

  List<_ColumnRowData> _orderedRows(UiState ui) {
    _ColumnRowData? detailsFor(String colId) {
      final builtIn = _kBuiltInLabels[colId];
      if (builtIn != null) {
        return _ColumnRowData(
          id: colId,
          label: builtIn,
          visible: ui.visibleColumns[colId] ?? false,
          badge: "built-in",
        );
      }
      CustomColumnDef? custom;
      for (final c in ui.customColumns) {
        if (c.id == colId) {
          custom = c;
          break;
        }
      }
      if (custom == null) return null;
      return _ColumnRowData(
        id: colId,
        label: custom.label,
        visible: ui.visibleColumns[colId] ?? false,
        badge: custom.source,
        // onDelete is wired in build() below (needs `ref`, unavailable here).
      );
    }

    return ui.columnOrder
        .map(detailsFor)
        .whereType<_ColumnRowData>()
        .toList();
  }

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final ui = ref.watch(uiProvider);
    final uiNotifier = ref.read(uiProvider.notifier);
    final collapsed = ui.columnManagerCollapsed;

    final rows = [
      for (final row in _orderedRows(ui))
        row.badge == "user"
            ? _ColumnRowData(
                id: row.id,
                label: row.label,
                visible: row.visible,
                badge: row.badge,
                onDelete: () => uiNotifier.removeCustomColumn(row.id),
              )
            : row,
    ];

    return ClipRect(
      child: AnimatedContainer(
        duration: const Duration(milliseconds: 220),
        curve: Curves.easeOutCubic,
        width: collapsed ? 0 : width,
        child: IgnorePointer(
          ignoring: collapsed,
          child: OverflowBox(
            minWidth: width,
            maxWidth: width,
            alignment: Alignment.centerLeft,
            child: SizedBox(
              width: width,
              child: DecoratedBox(
                decoration: const BoxDecoration(
                  color: AppColors.bgApp,
                  border: Border(right: BorderSide(color: AppColors.borderSubtle)),
                ),
                child: Column(
                  children: [
                    _Header(onClose: uiNotifier.toggleColumnManager),
                    Expanded(
                      child: _ColumnList(
                        rows: rows,
                        onToggle: uiNotifier.toggleColumnVisibility,
                        onReorder: (oldId, newId) =>
                            _reorder(ref, ui.columnOrder, oldId, newId),
                      ),
                    ),
                    _Footer(
                      onAddColumn: () => _openAddColumnModal(context, ref),
                    ),
                  ],
                ),
              ),
            ),
          ),
        ),
      ),
    );
  }

  void _reorder(WidgetRef ref, List<String> fullOrder, String movedId, String targetId) {
    final oldIdx = fullOrder.indexOf(movedId);
    final newIdx = fullOrder.indexOf(targetId);
    if (oldIdx == -1 || newIdx == -1 || oldIdx == newIdx) return;
    final next = List<String>.from(fullOrder);
    next.removeAt(oldIdx);
    next.insert(newIdx, movedId);
    ref.read(uiProvider.notifier).setColumnOrder(next);
  }

  Future<void> _openAddColumnModal(BuildContext context, WidgetRef ref) async {
    final workspaceState = ref.read(workspaceProvider);
    final workspaceId = workspaceState.activeWorkspaceId;
    final sourceId = workspaceState.activeSource?.id;
    await AddColumnModal.show(
      context,
      fetchSamples: () => workspaceId.isEmpty
          ? Future.value(const <String>[])
          : ref.read(workspaceProvider.notifier).getSampleLogs(
              workspaceId,
              sourceId: sourceId,
            ),
      onSave: (col) => ref.read(uiProvider.notifier).addCustomColumn(col),
    );
  }
}

class _Header extends StatelessWidget {
  const _Header({required this.onClose});
  final VoidCallback onClose;

  @override
  Widget build(BuildContext context) {
    return Container(
      height: 48,
      padding: const EdgeInsets.symmetric(horizontal: AppSpacing.md),
      decoration: const BoxDecoration(
        border: Border(bottom: BorderSide(color: AppColors.borderSubtle)),
      ),
      child: Row(
        mainAxisAlignment: MainAxisAlignment.spaceBetween,
        children: [
          Row(
            children: [
              const Icon(Icons.view_column_outlined, size: 14, color: AppColors.primary),
              const SizedBox(width: AppSpacing.xs),
              Text("COLUMNS", style: AppTypography.labelCaps),
            ],
          ),
          IconButton(
            icon: const Icon(Icons.keyboard_double_arrow_left, size: 16),
            tooltip: "Close Column Manager",
            color: AppColors.textMuted,
            splashRadius: 16,
            onPressed: onClose,
          ),
        ],
      ),
    );
  }
}

class _ColumnList extends StatelessWidget {
  const _ColumnList({required this.rows, required this.onToggle, required this.onReorder});

  final List<_ColumnRowData> rows;
  final ValueChanged<String> onToggle;

  /// (movedColumnId, targetColumnId)
  final void Function(String, String) onReorder;

  @override
  Widget build(BuildContext context) {
    return CustomScrollView(
      slivers: [
        SliverPadding(
          padding: const EdgeInsets.all(AppSpacing.sm),
          sliver: SliverToBoxAdapter(
            child: Text(
              "ACTIVE LAYOUT ORDER (DRAG TO SORT)",
              style: AppTypography.labelCaps.copyWith(fontSize: 9),
            ),
          ),
        ),
        SliverPadding(
          padding: const EdgeInsets.symmetric(horizontal: AppSpacing.sm),
          sliver: SliverReorderableList(
            itemCount: rows.length,
            itemBuilder: (context, index) {
              final row = rows[index];
              return _ColumnRow(
                key: ValueKey(row.id),
                index: index,
                data: row,
                onToggle: () => onToggle(row.id),
              );
            },
            onReorderItem: (oldIndex, newIndex) {
              if (oldIndex == newIndex) return;
              final movedId = rows[oldIndex].id;
              final targetId = rows[newIndex].id;
              onReorder(movedId, targetId);
            },
          ),
        ),
      ],
    );
  }
}

class _ColumnRow extends StatelessWidget {
  const _ColumnRow({
    required super.key,
    required this.index,
    required this.data,
    required this.onToggle,
  });

  final int index;
  final _ColumnRowData data;
  final VoidCallback onToggle;

  ({Color fg, Color bg, Color border, String text}) get _badgeStyle {
    switch (data.badge) {
      case "built-in":
        return (
          fg: AppColors.textMuted,
          bg: Colors.white.withValues(alpha: 0.05),
          border: Colors.white.withValues(alpha: 0.1),
          text: "built-in",
        );
      case "auto":
        return (
          fg: AppColors.info,
          bg: AppColors.info.withValues(alpha: 0.1),
          border: AppColors.info.withValues(alpha: 0.2),
          text: "auto",
        );
      default:
        return (
          fg: AppColors.accentViolet,
          bg: AppColors.accentViolet.withValues(alpha: 0.1),
          border: AppColors.accentViolet.withValues(alpha: 0.2),
          text: "regex",
        );
    }
  }

  @override
  Widget build(BuildContext context) {
    final badge = _badgeStyle;
    // Wrapped in its own transparent [Material]: [SliverReorderableList]
    // reparents the actively-dragged row into an [OverlayEntry] that is a
    // *sibling* of the page's own Material (not a descendant of it), so the
    // inner [InkWell]s below would otherwise throw "No Material widget
    // found" the instant a drag starts.
    return Material(
      type: MaterialType.transparency,
      child: Padding(
        padding: const EdgeInsets.symmetric(vertical: 2),
        child: Container(
          decoration: BoxDecoration(
            color: AppColors.bgApp.withValues(alpha: 0.5),
            borderRadius: BorderRadius.circular(AppRadius.sm),
          ),
          padding: const EdgeInsets.symmetric(horizontal: 6, vertical: 6),
          child: Row(
            children: [
              ReorderableDragStartListener(
                index: index,
                child: const Padding(
                  padding: EdgeInsets.all(4),
                  child: Icon(Icons.drag_indicator, size: 16, color: AppColors.textMuted),
                ),
              ),
              Expanded(
                child: InkWell(
                  onTap: onToggle,
                  child: Row(
                    children: [
                      _Checkbox(checked: data.visible),
                      const SizedBox(width: AppSpacing.sm),
                      Expanded(
                        child: Text(
                          data.label,
                          maxLines: 1,
                          overflow: TextOverflow.ellipsis,
                          style: AppTypography.body.copyWith(
                            fontSize: 12,
                            fontWeight: FontWeight.w500,
                            color: data.visible ? AppColors.textPrimary : AppColors.textMuted,
                          ),
                        ),
                      ),
                    ],
                  ),
                ),
              ),
              Container(
                padding: const EdgeInsets.symmetric(horizontal: 6, vertical: 2),
                decoration: BoxDecoration(
                  color: badge.bg,
                  border: Border.all(color: badge.border),
                  borderRadius: BorderRadius.circular(AppRadius.sm),
                ),
                child: Text(
                  badge.text.toUpperCase(),
                  style: TextStyle(
                    fontSize: 9,
                    fontWeight: FontWeight.w700,
                    letterSpacing: 0.5,
                    color: badge.fg,
                  ),
                ),
              ),
              if (data.onDelete != null)
                IconButton(
                  icon: const Icon(Icons.close, size: 12),
                  color: AppColors.textMuted,
                  tooltip: "Remove ${data.label} column",
                  splashRadius: 14,
                  constraints: const BoxConstraints(minWidth: 22, minHeight: 22),
                  padding: EdgeInsets.zero,
                  onPressed: data.onDelete,
                ),
            ],
          ),
        ),
      ),
    );
  }
}

class _Checkbox extends StatelessWidget {
  const _Checkbox({required this.checked});
  final bool checked;

  @override
  Widget build(BuildContext context) {
    return Container(
      width: 14,
      height: 14,
      decoration: BoxDecoration(
        color: checked ? AppColors.primary : Colors.transparent,
        border: Border.all(
          color: checked ? AppColors.primary : Colors.white.withValues(alpha: 0.2),
        ),
        borderRadius: BorderRadius.circular(3),
      ),
      child: checked
          ? const Icon(Icons.check, size: 10, color: Colors.white)
          : null,
    );
  }
}

class _Footer extends StatelessWidget {
  const _Footer({required this.onAddColumn});
  final VoidCallback onAddColumn;

  @override
  Widget build(BuildContext context) {
    return Container(
      padding: const EdgeInsets.all(AppSpacing.sm),
      decoration: const BoxDecoration(
        border: Border(top: BorderSide(color: AppColors.borderSubtle)),
      ),
      child: TextButton.icon(
        onPressed: onAddColumn,
        icon: const Icon(Icons.add, size: 14),
        label: const Text("Add Column"),
        style: TextButton.styleFrom(
          foregroundColor: AppColors.textMuted,
          textStyle: const TextStyle(fontSize: 12, fontWeight: FontWeight.w600),
          alignment: Alignment.centerLeft,
          padding: const EdgeInsets.symmetric(horizontal: AppSpacing.sm),
        ),
      ),
    );
  }
}
