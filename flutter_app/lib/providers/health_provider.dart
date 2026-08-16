/// Port of `src/store/healthStore.ts` (`useHealthStore`).
library;

import "package:flutter_riverpod/flutter_riverpod.dart";

import "../models/health_status.dart";
import "../services/sidecar_bridge.dart";
import "sidecar_provider.dart";

class HealthProviderState {
  const HealthProviderState({this.health, this.isPolling = false, this.error});
  final HealthStatus? health;
  final bool isPolling;
  final String? error;

  HealthProviderState copyWith({
    Object? health = _unset,
    bool? isPolling,
    Object? error = _unset,
  }) {
    return HealthProviderState(
      health: identical(health, _unset) ? this.health : health as HealthStatus?,
      isPolling: isPolling ?? this.isPolling,
      error: identical(error, _unset) ? this.error : error as String?,
    );
  }
}

const Object _unset = Object();

class HealthNotifier extends StateNotifier<HealthProviderState> {
  HealthNotifier(this._bridge) : super(const HealthProviderState());

  final SidecarBridge _bridge;

  Future<void> fetchHealth() async {
    try {
      final res = await _bridge.call<Map<String, dynamic>>("get_health", {});
      state = state.copyWith(
        health: HealthStatus.fromRpcResult(res, now: DateTime.now().millisecondsSinceEpoch),
        error: null,
      );
    } catch (e) {
      state = state.copyWith(
        health: HealthStatus.unreachable(now: DateTime.now().millisecondsSinceEpoch),
        error: e.toString(),
      );
    }
  }

  void setPolling(bool isPolling) => state = state.copyWith(isPolling: isPolling);
}

final healthProvider = StateNotifierProvider<HealthNotifier, HealthProviderState>((ref) {
  return HealthNotifier(ref.watch(sidecarBridgeProvider));
});
