/// Mirrors `src/store/healthStore.ts`'s `HealthStatus`.
class HydrationStatus {
  const HydrationStatus({required this.misses, required this.quarantineSize});

  final int misses;
  final int quarantineSize;

  factory HydrationStatus.fromJson(Map<String, dynamic> json) => HydrationStatus(
    misses: (json["misses"] as num?)?.toInt() ?? 0,
    quarantineSize: (json["quarantine_size"] as num?)?.toInt() ?? 0,
  );

  static const zero = HydrationStatus(misses: 0, quarantineSize: 0);
}

class WorkerStatus {
  const WorkerStatus({required this.clustering, required this.ingestion});

  final bool clustering;
  final bool ingestion;

  factory WorkerStatus.fromJson(Map<String, dynamic> json) => WorkerStatus(
    clustering: json["clustering"] as bool? ?? false,
    ingestion: json["ingestion"] as bool? ?? false,
  );

  static const allDown = WorkerStatus(clustering: false, ingestion: false);
}

/// 'healthy' | 'degraded' | 'unreachable'
enum HealthState { healthy, degraded, unreachable }

class HealthStatus {
  const HealthStatus({
    required this.status,
    required this.uptime,
    required this.hydration,
    required this.workers,
    required this.lastUpdate,
  });

  final HealthState status;
  final int uptime;
  final HydrationStatus hydration;
  final WorkerStatus workers;

  /// Epoch millis, set client-side on receipt (mirrors `Date.now()` in TS).
  final int lastUpdate;

  /// Builds from the raw `get_health` RPC result and derives [status]
  /// client-side, mirroring `healthStore.ts`'s `fetchHealth` logic:
  /// degraded if either worker is down or hydration misses > 100.
  factory HealthStatus.fromRpcResult(Map<String, dynamic> json, {required int now}) {
    final hydration = HydrationStatus.fromJson(
      json["hydration"] as Map<String, dynamic>? ?? const {},
    );
    final workers = WorkerStatus.fromJson(json["workers"] as Map<String, dynamic>? ?? const {});
    final degraded = !workers.clustering || !workers.ingestion || hydration.misses > 100;
    return HealthStatus(
      status: degraded ? HealthState.degraded : HealthState.healthy,
      uptime: (json["uptime"] as num?)?.toInt() ?? 0,
      hydration: hydration,
      workers: workers,
      lastUpdate: now,
    );
  }

  factory HealthStatus.unreachable({required int now}) => HealthStatus(
    status: HealthState.unreachable,
    uptime: 0,
    hydration: HydrationStatus.zero,
    workers: WorkerStatus.allDown,
    lastUpdate: now,
  );
}
