/// Mirrors `backend-go/internal/app/handlers_cluster.go`'s `GetClusters`
/// response shape: `[{id, template, size}, ...]` (no dedicated TS interface
/// exists on the React side — components consume the raw RPC shape there
/// too, so this is the canonical Dart-side definition).
class Cluster {
  const Cluster({required this.id, required this.template, required this.size});

  final String id;
  final String template;
  final int size;

  factory Cluster.fromJson(Map<String, dynamic> json) => Cluster(
    id: json["id"]?.toString() ?? "",
    template: json["template"] as String? ?? "",
    size: (json["size"] as num?)?.toInt() ?? 0,
  );

  Map<String, dynamic> toJson() => {"id": id, "template": template, "size": size};
}

/// Mirrors `src/store/clusteringStore.ts`'s `ClusteringStatus` /
/// `backend-go/internal/app/handlers_cluster.go`'s `GetClusteringStatus`.
enum ClusteringMode {
  auto,
  burst;

  String get wireValue => name;

  static ClusteringMode fromWire(String value) {
    return ClusteringMode.values.firstWhere(
      (m) => m.wireValue == value,
      orElse: () => ClusteringMode.auto,
    );
  }
}

class ClusteringStatus {
  const ClusteringStatus({
    required this.mode,
    required this.running,
    required this.paused,
    required this.backlog,
    required this.processedSession,
  });

  final ClusteringMode mode;
  final bool running;
  final bool paused;
  final int backlog;
  final int processedSession;

  factory ClusteringStatus.fromJson(Map<String, dynamic> json) => ClusteringStatus(
    mode: ClusteringMode.fromWire(json["mode"] as String? ?? "auto"),
    running: json["running"] as bool? ?? false,
    paused: json["paused"] as bool? ?? false,
    backlog: (json["backlog"] as num?)?.toInt() ?? 0,
    processedSession: (json["processed_session"] as num?)?.toInt() ?? 0,
  );

  ClusteringStatus copyWith({
    ClusteringMode? mode,
    bool? running,
    bool? paused,
    int? backlog,
    int? processedSession,
  }) {
    return ClusteringStatus(
      mode: mode ?? this.mode,
      running: running ?? this.running,
      paused: paused ?? this.paused,
      backlog: backlog ?? this.backlog,
      processedSession: processedSession ?? this.processedSession,
    );
  }
}
