/// Dart port of `src/components/organisms/VirtualLogTable.tsx`.
///
/// The single most central widget in the app: a virtualized table that
/// renders potentially millions of log rows at native speed. `ListView
/// .builder` with a fixed `itemExtent` is the Flutter equivalent of the
/// React source's `@tanstack/react-virtual` `useVirtualizer` -- both only
/// materialize widgets/DOM nodes for the rows currently near the viewport,
/// so no extra virtualization package is needed here.
///
/// Like the React source, this widget reaches into the app's shared state
/// directly for the pieces the React component also reads from Zustand
/// stores rather than props (multi-row selection via `investigationStore`,
/// column visibility/order/width via `uiStore`) -- everything else is a
/// constructor parameter, matching the React component's actual prop list.
///
/// ## Deviations from the React source (all intentional, documented here
/// so a follow-up pass can revisit them):
///
/// 1. **Fixed 40px row height with single-line truncation.** The React
///    version dynamically measures each row (`measureElement`) so wrapped
///    messages can grow taller. A fixed `itemExtent` is what makes
///    `ListView.builder` a true O(viewport) virtualizer with a cheap
///    `maxScrollExtent` computation -- exactly what this component's whole
///    purpose (smooth scrolling through huge row counts) depends on. Full,
///    un-truncated content is always reachable via the expand-detail panel.
/// 2. **No live column-width drag-resize.** The React version wires a
///    `mousedown`/`mousemove`/`mouseup` drag handle per header cell that
///    calls `setColumnWidth`. Reproducing that without a nested-gesture
///    conflict (the resize handle would sit inside the same hit-test region
///    as the sortable header button) is a bigger single-purpose task; column
///    widths are still fully configurable via `uiProvider.setColumnWidth`,
///    just not from an in-table drag handle yet. Flagged as a follow-up.
/// 3. **No inline text-selection toolbar** (React's floating
///    Include/Exclude/AI-Facet/Map-Field popover shown after selecting text
///    in a cell). That feature calls `useSettingsStore`/`callSidecar`
///    (`generate_facet_regex`) and isn't backed by any callback in this
///    widget's specified prop surface. "Open Parser" is still reachable --
///    via the row right-click context menu instead of the text-selection
///    toolbar.
/// 4. **Expand-detail panel shows more than the React source.** The React
///    `expandedRow` panel is *only* a comment editor. Per this port's
///    explicit spec ("see full raw message + all metadata fields"), the
///    Flutter panel also renders the raw message and a metadata chip list,
///    with the comment editor (Save/Delete) folded in below.
/// 5. **Simplified ingestion-overlay state machine.** The React version
///    derives `showPreparing`/`isQueued`/`isRehydrating`/`showHydrating`
///    from several other Zustand stores (`ingestionStore`, `workspaceStore`)
///    that aren't part of this widget's prop surface. This port collapses
///    that to three states driven purely by the given props: a job overlay
///    (`activeJob` active, or `isTransitioning`), a hydrating state (empty
///    + `isFetching`), and an empty state.
/// 6. **No "Batch AI Analysis" button in the multi-select pill.** That
///    button opens `aiStore`'s investigation sidebar with a session -- no
///    such callback/store is part of this widget's prop surface. The pill
///    still shows the selection count and a clear-selection action.
/// 7. **Actions column ports only the note/comment icon.** The React
///    `ActionsCell`'s second icon ("Start AI Analysis") depends on
///    `aiStore`/`logSessionMap`, out of scope here for the same reason as
///    (6).
library;

import "package:flutter/material.dart";
import "package:flutter/services.dart";
import "package:flutter_riverpod/flutter_riverpod.dart";

import "../../models/ingestion_job.dart";
import "../../models/log_entry.dart";
import "../../models/ui_column.dart";
import "../../providers/investigation_provider.dart";
import "../../providers/ui_provider.dart";
import "../../theme/app_theme.dart";
import "../atoms/icon_button.dart";
import "../atoms/log_level_badge.dart";
import "../molecules/highlight_builder.dart" show HighlightRule;
import "../molecules/ingestion_overlay.dart";

const double _kRowHeight = 40.0;
const double _kHeaderHeight = 40.0;
const double _kLeadWidth = 28.0;
const double _kFetchMoreThreshold = _kRowHeight * 10;

/// Columns sortable by clicking the header, mirrors the React source's
/// `isSortable` allow-list.
const Set<String> _kSortableColumns = {
  "id",
  "timestamp",
  "ingest_timestamp",
  "level",
  "cluster_id",
};

class VirtualLogTable extends ConsumerStatefulWidget {
  const VirtualLogTable({
    super.key,
    required this.logs,
    this.highlights = const [],
    required this.onAddComment,
    required this.onSort,
    this.onAnalyzeCluster,
    this.onOpenParser,
    required this.sortBy,
    required this.sortOrder,
    this.anomalousClusters,
    this.onImport,
    this.activeJob,
    this.isTransitioning = false,
    this.fetchMoreLogs,
    this.total,
    this.isFetching = false,
  });

  final List<LogEntry> logs;
  final List<HighlightRule> highlights;
  final void Function(int id, String comment) onAddComment;
  final void Function(String sortBy) onSort;
  final void Function(String clusterId)? onAnalyzeCluster;
  final void Function(String sourceId, String? initialConfig)? onOpenParser;
  final String sortBy;

  /// "asc" | "desc"
  final String sortOrder;
  final Set<String>? anomalousClusters;
  final VoidCallback? onImport;
  final IngestionJob? activeJob;
  final bool isTransitioning;
  final VoidCallback? fetchMoreLogs;
  final int? total;
  final bool isFetching;

  @override
  ConsumerState<VirtualLogTable> createState() => _VirtualLogTableState();
}

class _VirtualLogTableState extends ConsumerState<VirtualLogTable> {
  final ScrollController _scrollController = ScrollController();
  final TextEditingController _commentController = TextEditingController();
  int? _expandedLogId;
  int? _lastSelectedId;

  @override
  void initState() {
    super.initState();
    _scrollController.addListener(_maybeFetchMore);
    WidgetsBinding.instance.addPostFrameCallback((_) => _maybeFetchMore());
  }

  @override
  void didUpdateWidget(covariant VirtualLogTable oldWidget) {
    super.didUpdateWidget(oldWidget);

    if (widget.logs.length != oldWidget.logs.length) {
      WidgetsBinding.instance.addPostFrameCallback((_) => _maybeFetchMore());
    }

    final hasNewLogs = widget.logs.length > oldWidget.logs.length;
    final isTailing = ref.read(investigationProvider).isTailing;
    final isActivelyIngesting = widget.activeJob?.isActive ?? false;
    if (hasNewLogs && (isActivelyIngesting || isTailing)) {
      WidgetsBinding.instance.addPostFrameCallback((_) => _autoScroll());
    }

    // Expanded row no longer present in the new log batch (e.g. filters
    // changed) -- close the panel rather than pointing at a stale id.
    if (_expandedLogId != null && _findLog(_expandedLogId!) == null) {
      _expandedLogId = null;
    }
  }

  @override
  void dispose() {
    _scrollController.removeListener(_maybeFetchMore);
    _scrollController.dispose();
    _commentController.dispose();
    super.dispose();
  }

  // ── Infinite scroll ──────────────────────────────────────────────────

  void _maybeFetchMore() {
    final callback = widget.fetchMoreLogs;
    if (callback == null || widget.isFetching) return;
    final total = widget.total ?? 0;
    if (widget.logs.length >= total) return;
    if (!_scrollController.hasClients) return;

    final position = _scrollController.position;
    if (position.maxScrollExtent <= 0 ||
        (position.maxScrollExtent - position.pixels) <= _kFetchMoreThreshold) {
      callback();
    }
  }

  // ── Auto-scroll (tailing mode) ───────────────────────────────────────

  void _autoScroll() {
    if (!mounted || !_scrollController.hasClients) return;
    if (widget.sortOrder == "asc") {
      _scrollController.animateTo(
        _scrollController.position.maxScrollExtent,
        duration: const Duration(milliseconds: 300),
        curve: Curves.easeOut,
      );
    } else if (widget.sortBy == "timestamp" || widget.sortBy == "id") {
      if (_scrollController.position.pixels < 100) {
        _scrollController.animateTo(
          0,
          duration: const Duration(milliseconds: 300),
          curve: Curves.easeOut,
        );
      }
    }
  }

  // ── Selection ─────────────────────────────────────────────────────────

  void _handleSelectRow(int id) {
    final isShift = HardwareKeyboard.instance.isShiftPressed;
    final isMeta =
        HardwareKeyboard.instance.isControlPressed || HardwareKeyboard.instance.isMetaPressed;
    final notifier = ref.read(investigationProvider.notifier);
    final selected = ref.read(investigationProvider).selectedLogIds;
    final logs = widget.logs;

    if (isShift && _lastSelectedId != null) {
      final lastIndex = logs.indexWhere((l) => l.id == _lastSelectedId);
      final currentIndex = logs.indexWhere((l) => l.id == id);

      if (lastIndex == -1) {
        notifier.setSelectedLogIds([id]);
      } else {
        final start = lastIndex < currentIndex ? lastIndex : currentIndex;
        final end = lastIndex < currentIndex ? currentIndex : lastIndex;
        final rangeIds = logs.sublist(start, end + 1).map((l) => l.id).toList();

        if (isMeta) {
          notifier.setSelectedLogIds({...selected, ...rangeIds}.toList());
        } else {
          notifier.setSelectedLogIds(rangeIds);
        }
      }
    } else if (isMeta) {
      notifier.toggleLogSelection(id);
    } else {
      notifier.setSelectedLogIds([id]);
    }
    _lastSelectedId = id;
  }

  // ── Expand / comment ─────────────────────────────────────────────────

  LogEntry? _findLog(int id) {
    for (final l in widget.logs) {
      if (l.id == id) return l;
    }
    return null;
  }

  void _toggleExpand(LogEntry log) {
    setState(() {
      if (_expandedLogId == log.id) {
        _expandedLogId = null;
      } else {
        _expandedLogId = log.id;
        _commentController.text = log.comment ?? "";
      }
    });
  }

  // ── Context menu ──────────────────────────────────────────────────────

  Future<void> _showRowContextMenu(Offset globalPosition, LogEntry log) async {
    final selected = await showMenu<String>(
      context: context,
      position: RelativeRect.fromLTRB(
        globalPosition.dx,
        globalPosition.dy,
        globalPosition.dx,
        globalPosition.dy,
      ),
      color: AppColors.bgTooltip,
      items: [
        PopupMenuItem(
          value: "analyze",
          enabled: widget.onAnalyzeCluster != null && log.clusterId.isNotEmpty,
          child: const Text("Analyze Cluster"),
        ),
        PopupMenuItem(
          value: "parser",
          enabled: widget.onOpenParser != null,
          child: const Text("Open Parser"),
        ),
      ],
    );
    if (!mounted) return;
    if (selected == "analyze") widget.onAnalyzeCluster?.call(log.clusterId);
    if (selected == "parser") widget.onOpenParser?.call(log.sourceId, null);
  }

  // ── Build ────────────────────────────────────────────────────────────

  @override
  Widget build(BuildContext context) {
    final ui = ref.watch(uiProvider);
    final selectedIds = ref.watch(investigationProvider.select((s) => s.selectedLogIds));

    final cols = ui.columnOrder.where((c) => ui.visibleColumns[c] ?? false).toList();
    final specs = _buildSpecs(cols, ui.columnWidths);

    final showJobOverlay = (widget.activeJob?.isActive ?? false) || widget.isTransitioning;
    final showHydrating = !showJobOverlay && widget.logs.isEmpty && widget.isFetching;
    final showEmpty =
        !showJobOverlay && !showHydrating && widget.logs.isEmpty && !widget.isFetching;

    final hasMore = widget.logs.length < (widget.total ?? 0);
    final rowCount = widget.logs.length + (hasMore ? 1 : 0);

    final expandedLog = _expandedLogId != null ? _findLog(_expandedLogId!) : null;

    return Container(
      decoration: BoxDecoration(
        color: AppColors.bgBase,
        border: Border.all(color: AppColors.border),
        borderRadius: BorderRadius.circular(AppRadius.lg),
      ),
      clipBehavior: Clip.antiAlias,
      child: Stack(
        children: [
          Column(
            children: [
              _buildHeader(ui, selectedIds),
              Expanded(
                child: widget.logs.isEmpty
                    ? const SizedBox.shrink()
                    : ListView.builder(
                        controller: _scrollController,
                        itemExtent: _kRowHeight,
                        itemCount: rowCount,
                        itemBuilder: (context, index) {
                          if (index >= widget.logs.length) {
                            return _buildLoaderRow();
                          }
                          final log = widget.logs[index];
                          return _buildRow(
                            log,
                            selectedIds.contains(log.id),
                            _expandedLogId == log.id,
                            specs,
                            ui.customColumns,
                          );
                        },
                      ),
              ),
            ],
          ),
          if (showJobOverlay) IngestionOverlay(job: widget.activeJob),
          if (showHydrating)
            _centerState(
              icon: Icons.auto_awesome,
              title: "Retrieving logs...",
              subtitle: "Hydrating log records from storage and applying active filters.",
            ),
          if (showEmpty)
            _centerState(
              icon: Icons.upload_file_outlined,
              title: "No logs detected",
              subtitle:
                  "This workspace is currently empty. Connect a data source or upload a log "
                  "file to begin analysis.",
              action: ElevatedButton.icon(
                onPressed: widget.onImport,
                icon: const Icon(Icons.rocket_launch, size: 18),
                label: const Text("Import First Log"),
              ),
            ),
          if (expandedLog != null) _buildDetailPanel(expandedLog),
          if (selectedIds.isNotEmpty && expandedLog == null) _buildSelectionPill(selectedIds.length),
        ],
      ),
    );
  }

  // ── Header ───────────────────────────────────────────────────────────

  Widget _buildHeader(UiState ui, List<int> selectedIds) {
    final cols = ui.columnOrder.where((c) => ui.visibleColumns[c] ?? false).toList();
    final specs = _buildSpecs(cols, ui.columnWidths);
    final allSelected = widget.logs.isNotEmpty && selectedIds.length == widget.logs.length;

    return Container(
      height: _kHeaderHeight,
      decoration: const BoxDecoration(
        color: AppColors.bgSurface,
        border: Border(bottom: BorderSide(color: AppColors.border)),
      ),
      child: Row(
        children: [
          SizedBox(
            width: _kLeadWidth,
            child: InkWell(
              onTap: widget.logs.isEmpty
                  ? null
                  : () {
                      final notifier = ref.read(investigationProvider.notifier);
                      if (allSelected) {
                        notifier.clearSelection();
                      } else {
                        notifier.setSelectedLogIds(widget.logs.map((l) => l.id).toList());
                      }
                    },
              child: Center(
                child: Container(
                  width: 4,
                  height: 16,
                  decoration: BoxDecoration(
                    color: allSelected ? AppColors.primary : AppColors.border,
                    borderRadius: BorderRadius.circular(2),
                  ),
                ),
              ),
            ),
          ),
          for (final spec in specs) _buildHeaderCell(spec, ui.customColumns),
        ],
      ),
    );
  }

  Widget _buildHeaderCell(_ColSpec spec, List<CustomColumnDef> customColumns) {
    final label = _columnLabel(spec.id, customColumns);
    final sortable = _kSortableColumns.contains(spec.id);

    final Widget content = sortable
        ? InkWell(
            onTap: () => widget.onSort(spec.id),
            child: Padding(
              padding: const EdgeInsets.symmetric(horizontal: AppSpacing.sm),
              child: Row(
                mainAxisSize: MainAxisSize.min,
                children: [
                  Flexible(
                    child: Text(
                      label.toUpperCase(),
                      style: AppTypography.labelCaps,
                      overflow: TextOverflow.ellipsis,
                    ),
                  ),
                  const SizedBox(width: 4),
                  _sortIcon(spec.id),
                ],
              ),
            ),
          )
        : Padding(
            padding: const EdgeInsets.symmetric(horizontal: AppSpacing.sm),
            child: Text(
              label.toUpperCase(),
              style: AppTypography.labelCaps,
              overflow: TextOverflow.ellipsis,
            ),
          );

    final aligned = Align(alignment: Alignment.centerLeft, child: content);
    return spec.width == null ? Expanded(child: aligned) : SizedBox(width: spec.width, child: aligned);
  }

  Widget _sortIcon(String colId) {
    if (widget.sortBy != colId) {
      return const Icon(Icons.unfold_more, size: 12, color: AppColors.textMuted);
    }
    return Icon(
      widget.sortOrder == "asc" ? Icons.arrow_upward : Icons.arrow_downward,
      size: 12,
      color: AppColors.primary,
    );
  }

  // ── Rows ─────────────────────────────────────────────────────────────

  Widget _buildLoaderRow() {
    return SizedBox(
      height: _kRowHeight,
      child: Center(
        child: Row(
          mainAxisSize: MainAxisSize.min,
          children: [
            const SizedBox(
              width: 12,
              height: 12,
              child: CircularProgressIndicator(strokeWidth: 2, color: AppColors.primary),
            ),
            const SizedBox(width: AppSpacing.sm),
            Text(
              "Loading more records (${widget.logs.length} / ${widget.total ?? 0})...",
              style: AppTypography.log.copyWith(fontSize: 11, color: AppColors.textMuted),
            ),
          ],
        ),
      ),
    );
  }

  Widget _buildRow(
    LogEntry log,
    bool isSelected,
    bool isExpanded,
    List<_ColSpec> specs,
    List<CustomColumnDef> customColumns,
  ) {
    final nonActionSpecs = specs.where((s) => s.id != "actions").toList();
    final hasActions = specs.any((s) => s.id == "actions");
    final accent = _rowAccent(log.level);
    final bg = _rowBackground(log, isSelected, isExpanded);

    return Container(
      key: ValueKey(log.id),
      height: _kRowHeight,
      decoration: BoxDecoration(
        color: bg,
        border: Border(
          bottom: const BorderSide(color: AppColors.borderMuted),
          left: accent != null ? BorderSide(color: accent, width: 2) : BorderSide.none,
        ),
      ),
      child: Row(
        crossAxisAlignment: CrossAxisAlignment.stretch,
        children: [
          Expanded(
            child: GestureDetector(
              behavior: HitTestBehavior.opaque,
              onTap: () => _handleSelectRow(log.id),
              onSecondaryTapDown: (details) => _showRowContextMenu(details.globalPosition, log),
              child: Row(
                children: [
                  SizedBox(
                    width: _kLeadWidth,
                    child: Center(
                      child: isSelected
                          ? Container(
                              width: 3,
                              height: 18,
                              decoration: BoxDecoration(
                                color: AppColors.primary,
                                borderRadius: BorderRadius.circular(2),
                              ),
                            )
                          : const SizedBox.shrink(),
                    ),
                  ),
                  for (final spec in nonActionSpecs) _buildBodyCell(spec, log, customColumns),
                ],
              ),
            ),
          ),
          if (hasActions) _buildActionsCell(log),
        ],
      ),
    );
  }

  Widget _buildBodyCell(_ColSpec spec, LogEntry log, List<CustomColumnDef> customColumns) {
    final content = _cellContent(spec, log, customColumns);
    final padded = Padding(
      padding: const EdgeInsets.symmetric(horizontal: AppSpacing.sm),
      child: Align(alignment: Alignment.centerLeft, child: content),
    );
    return spec.width == null ? Expanded(child: padded) : SizedBox(width: spec.width, child: padded);
  }

  Widget _cellContent(_ColSpec spec, LogEntry log, List<CustomColumnDef> customColumns) {
    switch (spec.id) {
      case "id":
        return Text(
          "${log.lineId + 1}",
          style: AppTypography.log.copyWith(
            fontSize: 11,
            color: AppColors.textMuted,
            fontWeight: FontWeight.w700,
          ),
        );
      case "timestamp":
        return Text(
          log.timestamp,
          maxLines: 1,
          overflow: TextOverflow.ellipsis,
          style: AppTypography.log.copyWith(fontSize: 11, color: AppColors.textSecondary),
        );
      case "ingest_timestamp":
        return Text(
          log.ingestTimestamp ?? log.timestamp,
          maxLines: 1,
          overflow: TextOverflow.ellipsis,
          style: AppTypography.log.copyWith(fontSize: 11, color: AppColors.textSecondary),
        );
      case "level":
        return LogLevelBadge(level: log.level);
      case "message":
        return Text.rich(
          TextSpan(
            children: _highlightSpans(
              log.message,
              widget.highlights,
              AppTypography.log.copyWith(fontSize: 11, color: AppColors.textPrimary),
            ),
          ),
          maxLines: 1,
          overflow: TextOverflow.ellipsis,
        );
      case "cluster_id":
        return _buildClusterCell(log);
      default:
        final custom = customColumns.where((c) => c.id == spec.id);
        if (custom.isEmpty) return const SizedBox.shrink();
        return _buildCustomCell(log, custom.first);
    }
  }

  Widget _buildClusterCell(LogEntry log) {
    if (log.clusterId.isEmpty) {
      return Text(
        "—",
        style: AppTypography.log.copyWith(color: AppColors.textMuted.withValues(alpha: 0.3)),
      );
    }
    final isAnomalous = widget.anomalousClusters?.contains(log.clusterId) ?? false;
    final isUnknown = log.clusterId == "unknown";
    final fg = isUnknown
        ? AppColors.textMuted
        : (isAnomalous ? AppColors.warning : AppColors.primary);
    final bg = isUnknown
        ? AppColors.bgSurface
        : (isAnomalous
            ? AppColors.warning.withValues(alpha: 0.15)
            : AppColors.primary.withValues(alpha: 0.12));
    final label = log.clusterPercent != null
        ? "#${log.clusterId} · ${log.clusterPercent!.toStringAsFixed(1)}%"
        : "#${log.clusterId}";

    return InkWell(
      onTap: widget.onAnalyzeCluster == null ? null : () => widget.onAnalyzeCluster!(log.clusterId),
      borderRadius: BorderRadius.circular(AppRadius.sm),
      child: Tooltip(
        message: log.clusterTemplate ?? "Click to analyze",
        child: Container(
          padding: const EdgeInsets.symmetric(horizontal: 6, vertical: 2),
          decoration: BoxDecoration(
            color: bg,
            border: Border.all(color: fg.withValues(alpha: 0.4)),
            borderRadius: BorderRadius.circular(AppRadius.sm),
          ),
          child: Text(
            label,
            style: AppTypography.log.copyWith(fontSize: 9, fontWeight: FontWeight.w700, color: fg),
          ),
        ),
      ),
    );
  }

  Widget _buildCustomCell(LogEntry log, CustomColumnDef col) {
    final value = _customValue(log, col);
    if (value == null) {
      return Text(
        "—",
        style: AppTypography.log.copyWith(color: AppColors.textMuted.withValues(alpha: 0.3), fontSize: 11),
      );
    }
    var color = AppColors.textSecondary;
    if (col.id == "http_status") {
      final code = int.tryParse(value) ?? 0;
      if (code >= 500) {
        color = AppColors.error;
      } else if (code >= 400) {
        color = AppColors.warning;
      } else if (code >= 300) {
        color = AppColors.info;
      } else {
        color = AppColors.primary;
      }
    }
    return Text(
      value,
      maxLines: 1,
      overflow: TextOverflow.ellipsis,
      style: AppTypography.log.copyWith(fontSize: 11, color: color, fontWeight: FontWeight.w600),
    );
  }

  Widget _buildActionsCell(LogEntry log) {
    final hasComment = log.hasComment ?? false;
    return SizedBox(
      width: 56,
      child: Center(
        child: AppIconButton(
          icon: hasComment ? Icons.sticky_note_2 : Icons.sticky_note_2_outlined,
          tooltip: hasComment ? "View note" : "Add note",
          color: hasComment ? AppColors.primary : AppColors.textMuted,
          onPressed: () => _toggleExpand(log),
        ),
      ),
    );
  }

  Color? _rowAccent(String level) {
    switch (level.toUpperCase()) {
      case "FATAL":
      case "CRITICAL":
      case "ERROR":
        return AppColors.error;
      case "WARN":
        return AppColors.warning;
      case "TRACE":
      case "VERBOSE":
        return AppColors.primaryMuted;
      default:
        return null;
    }
  }

  Color _rowBackground(LogEntry log, bool isSelected, bool isExpanded) {
    if (isExpanded) return AppColors.primary.withValues(alpha: 0.10);
    if (isSelected) return AppColors.primary.withValues(alpha: 0.06);
    return AppColors.forLogLevel(log.level).withValues(alpha: 0.04);
  }

  // ── Detail panel ─────────────────────────────────────────────────────

  Widget _buildDetailPanel(LogEntry log) {
    return Positioned(
      left: 0,
      right: 0,
      bottom: 0,
      child: Container(
        constraints: const BoxConstraints(maxHeight: 340),
        decoration: const BoxDecoration(
          color: AppColors.bgTooltip,
          border: Border(top: BorderSide(color: AppColors.border)),
        ),
        child: SingleChildScrollView(
          padding: const EdgeInsets.all(AppSpacing.md),
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.start,
            mainAxisSize: MainAxisSize.min,
            children: [
              Row(
                children: [
                  const Icon(Icons.sticky_note_2_outlined, size: 16, color: AppColors.primary),
                  const SizedBox(width: AppSpacing.sm),
                  Expanded(
                    child: Text("Log Entry #${log.lineId + 1}", style: AppTypography.h2),
                  ),
                  if (log.hasComment ?? false)
                    TextButton(
                      onPressed: () {
                        widget.onAddComment(log.id, "");
                        _commentController.clear();
                      },
                      child: const Text("Delete note", style: TextStyle(color: AppColors.error)),
                    ),
                  TextButton(
                    onPressed: () => widget.onAddComment(log.id, _commentController.text),
                    child: const Text("Save note"),
                  ),
                  AppIconButton(
                    icon: Icons.close,
                    tooltip: "Close",
                    onPressed: () => setState(() => _expandedLogId = null),
                  ),
                ],
              ),
              const SizedBox(height: AppSpacing.sm),
              Text("RAW MESSAGE", style: AppTypography.labelCaps.copyWith(fontSize: 9)),
              const SizedBox(height: 4),
              Container(
                width: double.infinity,
                padding: const EdgeInsets.all(AppSpacing.sm),
                decoration: BoxDecoration(
                  color: AppColors.bgBase,
                  borderRadius: BorderRadius.circular(AppRadius.md),
                  border: Border.all(color: AppColors.borderMuted),
                ),
                child: SelectableText(log.rawText ?? log.message, style: AppTypography.log),
              ),
              const SizedBox(height: AppSpacing.sm),
              Text("METADATA", style: AppTypography.labelCaps.copyWith(fontSize: 9)),
              const SizedBox(height: 4),
              Wrap(
                spacing: 8,
                runSpacing: 8,
                children: [
                  _metaChip("ID", "${log.id}"),
                  _metaChip("Line", "${log.lineId + 1}"),
                  _metaChip("Timestamp", log.timestamp),
                  if (log.ingestTimestamp != null) _metaChip("Ingested", log.ingestTimestamp!),
                  _metaChip("Level", log.level),
                  if (log.clusterId.isNotEmpty) _metaChip("Cluster", log.clusterId),
                  if (log.clusterTemplate != null) _metaChip("Template", log.clusterTemplate!),
                  _metaChip("Source", log.sourceId),
                  if (log.facets != null)
                    for (final entry in log.facets!.entries) _metaChip(entry.key, entry.value),
                ],
              ),
              const SizedBox(height: AppSpacing.sm),
              Text("COMMENT", style: AppTypography.labelCaps.copyWith(fontSize: 9)),
              const SizedBox(height: 4),
              TextField(
                controller: _commentController,
                maxLines: 3,
                style: AppTypography.body.copyWith(fontSize: 12),
                decoration: const InputDecoration(
                  isDense: true,
                  hintText: "Add investigation details, identified causes, or diagnostic insights...",
                ),
              ),
            ],
          ),
        ),
      ),
    );
  }

  Widget _metaChip(String label, String value) {
    return Container(
      padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 4),
      decoration: BoxDecoration(
        color: AppColors.bgSurface,
        borderRadius: BorderRadius.circular(AppRadius.sm),
      ),
      child: RichText(
        text: TextSpan(
          style: AppTypography.log.copyWith(fontSize: 10, color: AppColors.textMuted),
          children: [
            TextSpan(text: "$label: "),
            TextSpan(
              text: value,
              style: const TextStyle(color: AppColors.textSecondary, fontWeight: FontWeight.w600),
            ),
          ],
        ),
      ),
    );
  }

  // ── Selection pill ───────────────────────────────────────────────────

  Widget _buildSelectionPill(int count) {
    return Positioned(
      bottom: AppSpacing.lg,
      left: 0,
      right: 0,
      child: Center(
        child: Container(
          padding: const EdgeInsets.symmetric(horizontal: AppSpacing.md, vertical: AppSpacing.sm),
          decoration: BoxDecoration(
            color: AppColors.bgTooltip,
            borderRadius: BorderRadius.circular(999),
            border: Border.all(color: AppColors.border),
          ),
          child: Row(
            mainAxisSize: MainAxisSize.min,
            children: [
              Text(
                "$count line${count == 1 ? '' : 's'} selected",
                style: AppTypography.body.copyWith(fontSize: 12, fontWeight: FontWeight.w700),
              ),
              const SizedBox(width: AppSpacing.sm),
              InkWell(
                onTap: () => ref.read(investigationProvider.notifier).clearSelection(),
                child: const Icon(Icons.close, size: 16, color: AppColors.textMuted),
              ),
            ],
          ),
        ),
      ),
    );
  }

  // ── Empty / hydrating state ──────────────────────────────────────────

  Widget _centerState({
    required IconData icon,
    required String title,
    required String subtitle,
    Widget? action,
  }) {
    return Positioned.fill(
      child: Container(
        color: AppColors.bgBase.withValues(alpha: 0.85),
        child: Center(
          child: Column(
            mainAxisSize: MainAxisSize.min,
            children: [
              Icon(icon, size: 40, color: AppColors.primary),
              const SizedBox(height: AppSpacing.md),
              Text(title, style: AppTypography.h1),
              const SizedBox(height: AppSpacing.xs),
              SizedBox(
                width: 280,
                child: Text(
                  subtitle,
                  textAlign: TextAlign.center,
                  style: AppTypography.body.copyWith(color: AppColors.textMuted, fontSize: 12),
                ),
              ),
              if (action != null) ...[const SizedBox(height: AppSpacing.lg), action],
            ],
          ),
        ),
      ),
    );
  }
}

// ── Column specs ───────────────────────────────────────────────────────

class _ColSpec {
  const _ColSpec(this.id, this.width);
  final String id;

  /// `null` means flexible (`Expanded`) -- only the "message" column.
  final double? width;
}

List<_ColSpec> _buildSpecs(List<String> cols, Map<String, String> widths) {
  return [for (final id in cols) _ColSpec(id, id == "message" ? null : _parseWidth(widths[id]))];
}

double? _parseWidth(String? raw) {
  if (raw == null) return 120.0;
  final cleaned = raw.replaceAll("px", "").trim();
  return double.tryParse(cleaned) ?? 120.0;
}

String _columnLabel(String colId, List<CustomColumnDef> customColumns) {
  switch (colId) {
    case "id":
      return "ID";
    case "timestamp":
      return "Timestamp";
    case "ingest_timestamp":
      return "Ingested";
    case "level":
      return "Level";
    case "message":
      return "Message";
    case "cluster_id":
      return "Cluster";
    case "actions":
      return "Actions";
  }
  final custom = customColumns.where((c) => c.id == colId);
  return custom.isNotEmpty ? custom.first.label : colId;
}

String? _customValue(LogEntry log, CustomColumnDef col) {
  if (col.source == "auto") return log.facets?[col.id];
  final pattern = col.regex;
  if (pattern == null || pattern.isEmpty) return null;
  try {
    final match = RegExp(pattern).firstMatch(log.rawText ?? log.message);
    if (match == null) return null;
    return (match.groupCount >= 1 ? match.group(1) : null) ?? match.group(0);
  } catch (_) {
    return null;
  }
}

// ── Highlighting ─────────────────────────────────────────────────────────

List<TextSpan> _highlightSpans(String text, List<HighlightRule> highlights, TextStyle base) {
  if (highlights.isEmpty || text.isEmpty) return [TextSpan(text: text, style: base)];
  final terms = highlights.where((h) => h.term.isNotEmpty).toList();
  if (terms.isEmpty) return [TextSpan(text: text, style: base)];

  final pattern = terms.map((h) => RegExp.escape(h.term)).join("|");
  RegExp regex;
  try {
    regex = RegExp("($pattern)", caseSensitive: false);
  } catch (_) {
    return [TextSpan(text: text, style: base)];
  }

  final spans = <TextSpan>[];
  var lastEnd = 0;
  for (final match in regex.allMatches(text)) {
    if (match.start > lastEnd) {
      spans.add(TextSpan(text: text.substring(lastEnd, match.start), style: base));
    }
    final matchedText = match.group(0)!;
    final rule = terms.firstWhere(
      (h) => h.term.toLowerCase() == matchedText.toLowerCase(),
      orElse: () => terms.first,
    );
    spans.add(
      TextSpan(
        text: matchedText,
        style: base.copyWith(
          color: rule.color,
          backgroundColor: rule.color.withValues(alpha: 0.2),
          fontWeight: FontWeight.w700,
        ),
      ),
    );
    lastEnd = match.end;
  }
  if (lastEnd < text.length) {
    spans.add(TextSpan(text: text.substring(lastEnd), style: base));
  }
  return spans;
}
