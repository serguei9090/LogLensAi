/// RPC gateway + held state for `get_dashboard_stats`, backing
/// `pages/dashboard_page.dart`.
///
/// The React source (`DashboardPage.tsx`'s `useDashboardData` hook) keeps
/// `stats`/`loading`/`timeBounds` as local component state and calls
/// `callSidecar` directly from a `useCallback`. Per this migration's
/// established convention (see `distribution_provider.dart`/
/// `fusion_provider.dart`'s doc comments for the same call on other
/// organism-scoped RPCs), this port promotes the *data* half (the fetch +
/// its result) to a proper [StateNotifierProvider] so [DashboardPage] can
/// `ref.watch` it directly instead of threading a callback-and-result pair
/// through local `setState` -- while the *filter* half (selected workspace/
/// source/time-range/mode) stays as [DashboardPage]'s own local widget
/// state, since those are page-local UI concerns, not shared app state any
/// other screen reads.
///
/// Deviation from the React hook: this intentionally drops the
/// `lastFetchedParamsRef` dedup-guard (skip an identical repeat fetch) --
/// it's a pure network-chatter optimization with no user-visible behavior
/// difference, and dropping it keeps this provider a plain "fetch on
/// request" gateway that's trivial to reason about/test.
library;

import "package:flutter_riverpod/flutter_riverpod.dart";

import "../models/dashboard_stats.dart";
import "../services/sidecar_bridge.dart";
import "sidecar_provider.dart";

class DashboardState {
  const DashboardState({this.loading = false, this.stats, this.error});

  final bool loading;
  final DashboardStats? stats;
  final String? error;

  DashboardState copyWith({
    bool? loading,
    Object? stats = _unset,
    Object? error = _unset,
  }) {
    return DashboardState(
      loading: loading ?? this.loading,
      stats: identical(stats, _unset) ? this.stats : stats as DashboardStats?,
      error: identical(error, _unset) ? this.error : error as String?,
    );
  }
}

const Object _unset = Object();

class DashboardNotifier extends StateNotifier<DashboardState> {
  DashboardNotifier(this._bridge) : super(const DashboardState());

  final SidecarBridge _bridge;

  /// Fetches `get_dashboard_stats` and stores the result. Mirrors the
  /// React hook's `fetchStats` params 1:1 (`workspace_id`/`source_id`
  /// resolve `"all"` -> `undefined`, `start_time`/`end_time` are omitted
  /// when empty). Returns the fetched [DashboardStats] (or `null` on
  /// failure) so the caller can synchronously react to `time_bounds`
  /// without a second `ref.watch` round-trip.
  Future<DashboardStats?> fetchStats({
    required String workspaceId,
    String sourceId = "all",
    String? startTime,
    String? endTime,
    List<String> activeWorkspaceIds = const [],
  }) async {
    state = state.copyWith(loading: true, error: null);
    try {
      final res = await _bridge.call<Map<String, dynamic>>("get_dashboard_stats", {
        "workspace_id": workspaceId == "all" ? null : workspaceId,
        "source_id": sourceId == "all" ? null : sourceId,
        if (startTime != null && startTime.isNotEmpty) "start_time": startTime,
        if (endTime != null && endTime.isNotEmpty) "end_time": endTime,
        "active_workspace_ids": activeWorkspaceIds,
      });
      final stats = DashboardStats.fromJson(res);
      state = state.copyWith(stats: stats, loading: false);
      return stats;
    } catch (e) {
      state = state.copyWith(loading: false, error: e.toString());
      return null;
    }
  }

  /// Fetches up to 10 raw log lines for [clusterId], mirroring
  /// `ClusterRow.tsx`'s inline `get_logs` call for its example-logs expand
  /// affordance -- an OR'd ERROR/FATAL/CRITICAL level filter is added
  /// when [isError], matching the React source's `type === "error"`
  /// branch. Returns `[]` on any RPC failure rather than throwing
  /// (mirrors the React `.catch(console.error)`-and-keep-empty-state
  /// behavior).
  Future<List<String>> fetchClusterSamples({
    required String workspaceId,
    required String clusterId,
    required bool isError,
  }) async {
    try {
      final filters = <Map<String, dynamic>>[
        {"field": "cluster_id", "operator": "equals", "value": clusterId},
        if (isError) ...[
          {"field": "level", "operator": "equals", "value": "ERROR"},
          {"field": "level", "operator": "equals", "value": "FATAL"},
          {"field": "level", "operator": "equals", "value": "CRITICAL"},
        ],
      ];
      final res = await _bridge.call<Map<String, dynamic>>("get_logs", {
        "workspace_id": workspaceId,
        "filters": filters,
        "limit": 10,
        "offset": 0,
      });
      final logs = res["logs"] as List<dynamic>? ?? const [];
      return logs
          .whereType<Map>()
          .map((l) => l["raw_text"]?.toString() ?? "")
          .toList();
    } catch (_) {
      return const [];
    }
  }

  void reset() => state = const DashboardState();
}

final dashboardProvider = StateNotifierProvider<DashboardNotifier, DashboardState>((ref) {
  return DashboardNotifier(ref.watch(sidecarBridgeProvider));
});
