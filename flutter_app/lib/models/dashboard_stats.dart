/// Mirrors `backend-go/internal/app/handlers_ai_extra.go`'s `GetDashboardStats`
/// RPC response shape (the Go port of `api.py`'s `method_get_dashboard_stats`).
/// No dedicated TS interface exists on the React side either -- `DashboardCharts.tsx`
/// and its siblings consume the raw untyped RPC payload (`stats: any`) -- so this is
/// the canonical Dart-side definition, introduced for this port.
library;

/// Top-level `get_dashboard_stats` response.
class DashboardStats {
  const DashboardStats({
    this.totalLogs = 0,
    this.totalClusters = 0,
    this.levelCounts = const {},
    this.topClusters = const [],
    this.topErrorClusters = const [],
    this.timeSeries = const [],
    this.sourceHeatmap = const [],
    this.latestInsight,
    this.newPatternsCount = 0,
    this.workspaceCount = 0,
    this.activeTailers = 0,
    this.bucketInterval = "1 hour",
    this.timeBounds,
  });

  final int totalLogs;
  final int totalClusters;

  /// Raw per-level counts as returned by the backend (e.g. `{"ERROR": 12,
  /// "INFO": 340, ...}`) -- keys are whatever `logs.level` values exist in
  /// the DB, not normalized to the 4 display levels. Use
  /// [DashboardTimeSeriesPoint]'s `debug`/`info`/`warn`/`error` getters (or
  /// replicate the same aggregation over this map) to get the normalized
  /// DEBUG/INFO/WARN/ERROR breakdown used by the UI.
  final Map<String, int> levelCounts;

  final List<DashboardClusterSummary> topClusters;
  final List<DashboardClusterSummary> topErrorClusters;

  /// Bucketed time series, one entry per `bucket_interval`-sized slot,
  /// gap-filled across the requested range (`buildDashboardTimeSeries` on
  /// the Go side) -- always sorted ascending by timestamp.
  final List<DashboardTimeSeriesPoint> timeSeries;

  final List<DashboardSourceHeatmapPoint> sourceHeatmap;

  /// Truncated (150-char) latest AI assistant message content, or null if
  /// no AI session has ever produced one.
  final String? latestInsight;

  final int newPatternsCount;
  final int workspaceCount;
  final int activeTailers;

  /// One of `dashboardIntervals`' keys on the Go side (e.g. "1 hour", "15
  /// minutes") -- dynamically chosen server-side from the selected time
  /// range's span. Mirrors `DashboardChartsProps.bucketInterval`.
  final String bucketInterval;

  final DashboardTimeBounds? timeBounds;

  factory DashboardStats.fromJson(Map<String, dynamic> json) {
    return DashboardStats(
      totalLogs: (json["total_logs"] as num?)?.toInt() ?? 0,
      totalClusters: (json["total_clusters"] as num?)?.toInt() ?? 0,
      levelCounts: _toIntMap(json["level_counts"]),
      topClusters: _toClusterList(json["top_clusters"]),
      topErrorClusters: _toClusterList(json["top_error_clusters"]),
      timeSeries: _toTimeSeriesList(json["time_series"]),
      sourceHeatmap: _toHeatmapList(json["source_heatmap"]),
      latestInsight: json["latest_insight"] as String?,
      newPatternsCount: (json["new_patterns_count"] as num?)?.toInt() ?? 0,
      workspaceCount: (json["workspace_count"] as num?)?.toInt() ?? 0,
      activeTailers: (json["active_tailers"] as num?)?.toInt() ?? 0,
      bucketInterval: json["bucket_interval"] as String? ?? "1 hour",
      timeBounds: json["time_bounds"] is Map
          ? DashboardTimeBounds.fromJson(
              (json["time_bounds"] as Map).cast<String, dynamic>(),
            )
          : null,
    );
  }
}

/// One row of `top_clusters` / `top_error_clusters`
/// (`{template, count, cluster_id}` per `runClusterAggQuery`).
class DashboardClusterSummary {
  const DashboardClusterSummary({
    required this.template,
    required this.count,
    required this.clusterId,
  });

  final String template;
  final int count;
  final String clusterId;

  factory DashboardClusterSummary.fromJson(Map<String, dynamic> json) {
    return DashboardClusterSummary(
      template: json["template"] as String? ?? "",
      count: (json["count"] as num?)?.toInt() ?? 0,
      clusterId: json["cluster_id"]?.toString() ?? "",
    );
  }
}

/// One bucket of `time_series`: a `timestamp` label plus raw per-level
/// counts for that bucket (gap-filled buckets always carry
/// DEBUG/INFO/WARN/ERROR = 0 at minimum; real data may add other level
/// strings like "FATAL"/"WARNING"/lowercase variants -- see
/// `buildDashboardTimeSeries`).
///
/// The `debug`/`info`/`warn`/`error` getters below reproduce
/// `DashboardCharts.tsx`'s `chartData` normalization exactly (WARN folds in
/// WARNING/warn, ERROR folds in FATAL/CRITICAL/error).
class DashboardTimeSeriesPoint {
  const DashboardTimeSeriesPoint({required this.timestamp, required this.rawLevelCounts});

  final String timestamp;
  final Map<String, int> rawLevelCounts;

  int _count(String key) => rawLevelCounts[key] ?? 0;

  int get debug => _count("DEBUG") + _count("debug");
  int get info => _count("INFO") + _count("info");
  int get warn => _count("WARN") + _count("WARNING") + _count("warn");
  int get error =>
      _count("ERROR") + _count("FATAL") + _count("CRITICAL") + _count("error");

  /// Sum of the 4 normalized display levels for this bucket -- used as the
  /// stacked-bar total and as the denominator for the error-rate trend.
  int get total => debug + info + warn + error;

  factory DashboardTimeSeriesPoint.fromJson(Map<String, dynamic> json) {
    final raw = <String, int>{};
    for (final entry in json.entries) {
      if (entry.key == "timestamp") continue;
      final v = entry.value;
      if (v is num) raw[entry.key] = v.toInt();
    }
    return DashboardTimeSeriesPoint(
      timestamp: json["timestamp"] as String? ?? "",
      rawLevelCounts: raw,
    );
  }
}

/// One row of `source_heatmap` (`{timestamp, source_id, source_name,
/// count}` per `fetchSourceHeatmap`). Not consumed by the chart trio this
/// model was added for, but included for parity with the full backend
/// response shape.
class DashboardSourceHeatmapPoint {
  const DashboardSourceHeatmapPoint({
    required this.timestamp,
    required this.sourceId,
    required this.sourceName,
    required this.count,
  });

  final String timestamp;
  final String sourceId;
  final String sourceName;
  final int count;

  factory DashboardSourceHeatmapPoint.fromJson(Map<String, dynamic> json) {
    return DashboardSourceHeatmapPoint(
      timestamp: json["timestamp"] as String? ?? "",
      sourceId: json["source_id"]?.toString() ?? "",
      sourceName: json["source_name"] as String? ?? "",
      count: (json["count"] as num?)?.toInt() ?? 0,
    );
  }
}

/// `time_bounds`: min/max timestamp actually present in the (unfiltered)
/// data, used for the "is the dashboard currently zoomed away from All
/// Time?" comparison and for the Reset-to-All-Time action.
class DashboardTimeBounds {
  const DashboardTimeBounds({required this.min, required this.max});

  final String min;
  final String max;

  factory DashboardTimeBounds.fromJson(Map<String, dynamic> json) {
    return DashboardTimeBounds(
      min: json["min"] as String? ?? "",
      max: json["max"] as String? ?? "",
    );
  }
}

Map<String, int> _toIntMap(dynamic value) {
  if (value is! Map) return const {};
  final out = <String, int>{};
  for (final entry in value.entries) {
    final v = entry.value;
    if (v is num) out[entry.key.toString()] = v.toInt();
  }
  return out;
}

List<DashboardClusterSummary> _toClusterList(dynamic value) {
  if (value is! List) return const [];
  return [
    for (final item in value)
      if (item is Map) DashboardClusterSummary.fromJson(item.cast<String, dynamic>()),
  ];
}

List<DashboardTimeSeriesPoint> _toTimeSeriesList(dynamic value) {
  if (value is! List) return const [];
  return [
    for (final item in value)
      if (item is Map) DashboardTimeSeriesPoint.fromJson(item.cast<String, dynamic>()),
  ];
}

List<DashboardSourceHeatmapPoint> _toHeatmapList(dynamic value) {
  if (value is! List) return const [];
  return [
    for (final item in value)
      if (item is Map) DashboardSourceHeatmapPoint.fromJson(item.cast<String, dynamic>()),
  ];
}
