/// Mirrors `src/types/log.ts`'s `LogEntry`/`LogLevel`.
library;

const List<String> kLogLevels = [
  "DEBUG",
  "INFO",
  "WARN",
  "ERROR",
  "FATAL",
  "TRACE",
  "VERBOSE",
  "CRITICAL",
];

class LogEntry {
  const LogEntry({
    required this.id,
    required this.lineId,
    required this.timestamp,
    this.ingestTimestamp,
    required this.level,
    required this.message,
    required this.clusterId,
    required this.sourceId,
    this.clusterPercent,
    this.clusterTemplate,
    this.hasComment,
    this.comment,
    this.rawText,
    this.facets,
  });

  final int id;
  final int lineId;
  final String timestamp;
  final String? ingestTimestamp;
  final String level;
  final String message;
  final String clusterId;
  final String sourceId;
  final double? clusterPercent;
  final String? clusterTemplate;
  final bool? hasComment;
  final String? comment;
  final String? rawText;
  final Map<String, String>? facets;

  factory LogEntry.fromJson(Map<String, dynamic> json) {
    return LogEntry(
      id: (json["id"] as num).toInt(),
      lineId: (json["line_id"] as num?)?.toInt() ?? 0,
      timestamp: json["timestamp"] as String? ?? "",
      ingestTimestamp: json["ingest_timestamp"] as String?,
      level: json["level"] as String? ?? "INFO",
      message: json["message"] as String? ?? "",
      clusterId: json["cluster_id"]?.toString() ?? "",
      sourceId: json["source_id"]?.toString() ?? "",
      clusterPercent: (json["cluster_percent"] as num?)?.toDouble(),
      clusterTemplate: json["cluster_template"] as String?,
      hasComment: json["has_comment"] as bool?,
      comment: json["comment"] as String?,
      rawText: json["raw_text"] as String?,
      facets: (json["facets"] as Map?)?.map(
        (k, v) => MapEntry(k.toString(), v?.toString() ?? ""),
      ),
    );
  }

  Map<String, dynamic> toJson() => {
    "id": id,
    "line_id": lineId,
    "timestamp": timestamp,
    if (ingestTimestamp != null) "ingest_timestamp": ingestTimestamp,
    "level": level,
    "message": message,
    "cluster_id": clusterId,
    "source_id": sourceId,
    if (clusterPercent != null) "cluster_percent": clusterPercent,
    if (clusterTemplate != null) "cluster_template": clusterTemplate,
    if (hasComment != null) "has_comment": hasComment,
    if (comment != null) "comment": comment,
    if (rawText != null) "raw_text": rawText,
    if (facets != null) "facets": facets,
  };

  LogEntry copyWith({
    int? id,
    int? lineId,
    String? timestamp,
    String? ingestTimestamp,
    String? level,
    String? message,
    String? clusterId,
    String? sourceId,
    double? clusterPercent,
    String? clusterTemplate,
    bool? hasComment,
    String? comment,
    String? rawText,
    Map<String, String>? facets,
  }) {
    return LogEntry(
      id: id ?? this.id,
      lineId: lineId ?? this.lineId,
      timestamp: timestamp ?? this.timestamp,
      ingestTimestamp: ingestTimestamp ?? this.ingestTimestamp,
      level: level ?? this.level,
      message: message ?? this.message,
      clusterId: clusterId ?? this.clusterId,
      sourceId: sourceId ?? this.sourceId,
      clusterPercent: clusterPercent ?? this.clusterPercent,
      clusterTemplate: clusterTemplate ?? this.clusterTemplate,
      hasComment: hasComment ?? this.hasComment,
      comment: comment ?? this.comment,
      rawText: rawText ?? this.rawText,
      facets: facets ?? this.facets,
    );
  }
}

/// A filter clause, mirrors Go's `models.LogFilter` / TS's `LogFilter`.
class LogFilter {
  const LogFilter({
    required this.field,
    required this.value,
    this.operator = "contains",
  });

  final String field;
  final String value;
  final String operator;

  factory LogFilter.fromJson(Map<String, dynamic> json) => LogFilter(
    field: json["field"] as String? ?? "",
    value: json["value"] as String? ?? "",
    operator: json["operator"] as String? ?? "contains",
  );

  Map<String, dynamic> toJson() => {
    "field": field,
    "value": value,
    "operator": operator,
  };
}
