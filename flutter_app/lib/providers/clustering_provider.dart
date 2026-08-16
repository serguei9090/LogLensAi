/// Port of `src/store/clusteringStore.ts` (`useClusteringStore`).
library;

import "package:flutter_riverpod/flutter_riverpod.dart";

import "../models/cluster.dart";
import "../services/sidecar_bridge.dart";
import "sidecar_provider.dart";

class ClusteringState {
  const ClusteringState({this.status, this.error});
  final ClusteringStatus? status;
  final String? error;

  ClusteringState copyWith({
    Object? status = _unset,
    Object? error = _unset,
  }) {
    return ClusteringState(
      status: identical(status, _unset) ? this.status : status as ClusteringStatus?,
      error: identical(error, _unset) ? this.error : error as String?,
    );
  }
}

const Object _unset = Object();

class ClusteringNotifier extends StateNotifier<ClusteringState> {
  ClusteringNotifier(this._bridge) : super(const ClusteringState());

  final SidecarBridge _bridge;

  Future<void> fetchStatus({String? workspaceId}) async {
    try {
      final res = await _bridge.call<Map<String, dynamic>>(
        "get_clustering_status",
        {"workspace_id": workspaceId},
      );
      state = state.copyWith(status: ClusteringStatus.fromJson(res), error: null);
    } catch (e) {
      state = state.copyWith(error: e.toString());
    }
  }

  Future<void> setMode(ClusteringMode mode, {String? workspaceId}) async {
    try {
      await _bridge.call("set_clustering_mode", {
        "mode": mode.wireValue,
        "workspace_id": workspaceId,
      });
      final current = state.status;
      if (current != null) {
        state = state.copyWith(status: current.copyWith(mode: mode, paused: false));
      }
      await fetchStatus(workspaceId: workspaceId);
    } catch (e) {
      state = state.copyWith(error: e.toString());
    }
  }

  Future<void> setPaused(bool paused, {String? workspaceId}) async {
    try {
      await _bridge.call("set_clustering_paused", {
        "paused": paused,
        "workspace_id": workspaceId,
      });
      final current = state.status;
      if (current != null) {
        state = state.copyWith(status: current.copyWith(paused: paused));
      }
      await fetchStatus(workspaceId: workspaceId);
    } catch (e) {
      state = state.copyWith(error: e.toString());
    }
  }
}

final clusteringProvider = StateNotifierProvider<ClusteringNotifier, ClusteringState>((ref) {
  return ClusteringNotifier(ref.watch(sidecarBridgeProvider));
});
