/// Port of `src/store/investigationStore.ts` (`useInvestigationStore`).
/// `FilterEntry`/`HighlightEntry` (from `FilterBuilder`/`HighlightBuilder`
/// molecules) aren't ported yet since those UI molecules don't exist in
/// Flutter yet either -- `filters`/`highlights` are typed as
/// `List<Map<String, dynamic>>` placeholders until the molecule pass lands
/// and defines the real shape.
library;

import "package:flutter_riverpod/flutter_riverpod.dart";

import "../models/log_entry.dart";

class TimeRange {
  const TimeRange({required this.start, required this.end, this.label});
  final String start;
  final String end;
  final String? label;

  static const empty = TimeRange(start: "", end: "");
}

class FacetValue {
  const FacetValue({required this.value, required this.count});
  final String value;
  final int count;
}

/// Per-source snapshot of investigation UI state, mirrors TS `SourceState`.
class SourceState {
  const SourceState({
    this.searchQuery = "",
    this.filters = const [],
    this.highlights = const [],
    this.logs = const [],
    this.total = 0,
    this.offset = 0,
    this.sortBy = "timestamp",
    this.sortOrder = "desc",
    this.timeRange = TimeRange.empty,
    this.timeRangeBounds = TimeRange.empty,
    this.selectedLogIds = const [],
    this.availableFacets = const {},
  });

  final String searchQuery;
  final List<Map<String, dynamic>> filters;
  final List<Map<String, dynamic>> highlights;
  final List<LogEntry> logs;
  final int total;
  final int offset;
  final String sortBy;
  final String sortOrder; // 'asc' | 'desc'
  final TimeRange timeRange;
  final TimeRange timeRangeBounds;
  final List<int> selectedLogIds;
  final Map<String, List<FacetValue>> availableFacets;

  static const defaults = SourceState();
}

class InvestigationState extends SourceState {
  const InvestigationState({
    super.searchQuery,
    super.filters,
    super.highlights,
    super.logs,
    super.total,
    super.offset,
    super.sortBy,
    super.sortOrder,
    super.timeRange,
    super.timeRangeBounds,
    super.selectedLogIds,
    super.availableFacets,
    this.isTailing = false,
    this.showDistribution = false,
    this.showAnomalies = false,
    this.workspaceGlobalContext,
    this.currentSourceId = "aggregate",
    this.sourceStates = const {},
  });

  final bool isTailing;
  final bool showDistribution;
  final bool showAnomalies;
  final String? workspaceGlobalContext;

  /// Currently active source ID, or 'aggregate' for the All view.
  final String currentSourceId;

  /// Persisted map of states for each source encountered this session.
  final Map<String, SourceState> sourceStates;

  SourceState _asSourceState() => SourceState(
    searchQuery: searchQuery,
    filters: filters,
    highlights: highlights,
    logs: logs,
    total: total,
    offset: offset,
    sortBy: sortBy,
    sortOrder: sortOrder,
    timeRange: timeRange,
    timeRangeBounds: timeRangeBounds,
    selectedLogIds: selectedLogIds,
    availableFacets: availableFacets,
  );

  InvestigationState copyWith({
    String? searchQuery,
    List<Map<String, dynamic>>? filters,
    List<Map<String, dynamic>>? highlights,
    List<LogEntry>? logs,
    int? total,
    int? offset,
    String? sortBy,
    String? sortOrder,
    TimeRange? timeRange,
    TimeRange? timeRangeBounds,
    List<int>? selectedLogIds,
    Map<String, List<FacetValue>>? availableFacets,
    bool? isTailing,
    bool? showDistribution,
    bool? showAnomalies,
    Object? workspaceGlobalContext = _unset,
    String? currentSourceId,
    Map<String, SourceState>? sourceStates,
  }) {
    return InvestigationState(
      searchQuery: searchQuery ?? this.searchQuery,
      filters: filters ?? this.filters,
      highlights: highlights ?? this.highlights,
      logs: logs ?? this.logs,
      total: total ?? this.total,
      offset: offset ?? this.offset,
      sortBy: sortBy ?? this.sortBy,
      sortOrder: sortOrder ?? this.sortOrder,
      timeRange: timeRange ?? this.timeRange,
      timeRangeBounds: timeRangeBounds ?? this.timeRangeBounds,
      selectedLogIds: selectedLogIds ?? this.selectedLogIds,
      availableFacets: availableFacets ?? this.availableFacets,
      isTailing: isTailing ?? this.isTailing,
      showDistribution: showDistribution ?? this.showDistribution,
      showAnomalies: showAnomalies ?? this.showAnomalies,
      workspaceGlobalContext: identical(workspaceGlobalContext, _unset)
          ? this.workspaceGlobalContext
          : workspaceGlobalContext as String?,
      currentSourceId: currentSourceId ?? this.currentSourceId,
      sourceStates: sourceStates ?? this.sourceStates,
    );
  }
}

const Object _unset = Object();

class InvestigationNotifier extends StateNotifier<InvestigationState> {
  InvestigationNotifier() : super(const InvestigationState());

  /// Swaps the active state for another source's state, mirroring
  /// `investigationStore.ts`'s `syncActiveSource`.
  void syncActiveSource(String? sourceId) {
    final nextId = sourceId ?? "aggregate";
    if (nextId == state.currentSourceId) return;

    final updatedMap = {
      ...state.sourceStates,
      state.currentSourceId: state._asSourceState(),
    };
    final next = updatedMap[nextId] ?? SourceState.defaults;

    state = InvestigationState(
      searchQuery: next.searchQuery,
      filters: next.filters,
      highlights: next.highlights,
      logs: next.logs,
      total: next.total,
      offset: next.offset,
      sortBy: next.sortBy,
      sortOrder: next.sortOrder,
      timeRange: next.timeRange,
      timeRangeBounds: next.timeRangeBounds,
      selectedLogIds: next.selectedLogIds,
      availableFacets: next.availableFacets,
      isTailing: state.isTailing,
      showDistribution: state.showDistribution,
      showAnomalies: state.showAnomalies,
      workspaceGlobalContext: state.workspaceGlobalContext,
      currentSourceId: nextId,
      sourceStates: updatedMap,
    );
  }

  void setSearchQuery(String q) => state = state.copyWith(searchQuery: q);
  void setFilters(List<Map<String, dynamic>> f) => state = state.copyWith(filters: f);
  void setHighlights(List<Map<String, dynamic>> h) => state = state.copyWith(highlights: h);
  void setLogs(List<LogEntry> logs, int total) =>
      state = state.copyWith(logs: logs, total: total);

  void updateLog(int id, LogEntry Function(LogEntry) updater) {
    state = state.copyWith(
      logs: [for (final l in state.logs) if (l.id == id) updater(l) else l],
    );
  }

  void setTailing(bool v) => state = state.copyWith(isTailing: v);
  void setSort(String by, String order) =>
      state = state.copyWith(sortBy: by, sortOrder: order);
  void setShowDistribution(bool v) => state = state.copyWith(showDistribution: v);
  void setShowAnomalies(bool v) => state = state.copyWith(showAnomalies: v);
  void setWorkspaceGlobalContext(String? v) =>
      state = state.copyWith(workspaceGlobalContext: v);
  void setTimeRange(TimeRange range) => state = state.copyWith(timeRange: range);
  void setTimeRangeBounds(TimeRange bounds) => state = state.copyWith(timeRangeBounds: bounds);

  void resetTimeRangeToAllTime() {
    state = state.copyWith(
      timeRange: TimeRange(
        start: state.timeRangeBounds.start,
        end: state.timeRangeBounds.end,
        label: "All Time",
      ),
    );
  }

  void setSelectedLogIds(List<int> ids) => state = state.copyWith(selectedLogIds: ids);

  void toggleLogSelection(int id) {
    final selected = state.selectedLogIds;
    state = state.copyWith(
      selectedLogIds: selected.contains(id)
          ? selected.where((x) => x != id).toList()
          : [...selected, id],
    );
  }

  void clearSelection() => state = state.copyWith(selectedLogIds: const []);

  void setAvailableFacets(Map<String, List<FacetValue>> facets) =>
      state = state.copyWith(availableFacets: facets);

  void reset() => state = const InvestigationState();
}

final investigationProvider =
    StateNotifierProvider<InvestigationNotifier, InvestigationState>(
      (ref) => InvestigationNotifier(),
    );
