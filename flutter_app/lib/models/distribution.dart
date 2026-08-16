/// Mirrors the `Bucket`/`Anomaly` interfaces defined inline in
/// `src/components/organisms/LogDistributionWidget.tsx` (local to that
/// component, no dedicated TS type file). Result shapes for the
/// `get_log_distribution` / `get_anomalies` RPC methods.
library;

/// One time-bucketed slice of the distribution histogram. The React source
/// types this with explicit `INFO`/`ERROR`/`WARN` fields plus a string index
/// signature for any other level; [levelCounts] keeps that generality by
/// collecting every non-`bucket` numeric key the backend returns instead of
/// hardcoding the three well-known levels.
class DistributionBucket {
  const DistributionBucket({required this.bucket, required this.levelCounts});

  /// Raw bucket timestamp label as returned by the backend, e.g.
  /// `"2026-08-14 09:00:00"`.
  final String bucket;

  /// Level name (upper-cased, e.g. `"INFO"`) -> count within this bucket.
  final Map<String, int> levelCounts;

  int get total => levelCounts.values.fold(0, (sum, v) => sum + v);

  factory DistributionBucket.fromJson(Map<String, dynamic> json) {
    final counts = <String, int>{};
    for (final entry in json.entries) {
      if (entry.key == "bucket") continue;
      final v = entry.value;
      if (v is num) counts[entry.key] = v.toInt();
    }
    return DistributionBucket(bucket: json["bucket"]?.toString() ?? "", levelCounts: counts);
  }
}

/// A detected volume-spike anomaly for a cluster at a given bucket.
class LogAnomaly {
  const LogAnomaly({
    required this.clusterId,
    required this.timestamp,
    required this.zScore,
    required this.currentRate,
  });

  final String clusterId;
  final String timestamp;
  final double zScore;
  final double currentRate;

  factory LogAnomaly.fromJson(Map<String, dynamic> json) => LogAnomaly(
    clusterId: json["cluster_id"]?.toString() ?? "",
    timestamp: json["timestamp"] as String? ?? "",
    zScore: (json["z_score"] as num?)?.toDouble() ?? 0,
    currentRate: (json["current_rate"] as num?)?.toDouble() ?? 0,
  );
}
