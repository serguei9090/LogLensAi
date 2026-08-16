/// Mirrors `src/store/ingestionStore.ts`'s `IngestionJob`.
class IngestionJob {
  const IngestionJob({
    required this.id,
    required this.workspaceId,
    required this.sourceId,
    required this.status,
    required this.totalLines,
    required this.processedLines,
    required this.queuePosition,
    required this.createdAt,
    required this.updatedAt,
  });

  final int id;
  final String workspaceId;
  final String sourceId;

  /// 'queued' | 'pending' | 'processing' | 'completed' | 'failed'
  final String status;
  final int totalLines;
  final int processedLines;

  /// 1-based position in the active queue. 0 = not queued (completed/failed).
  final int queuePosition;
  final String createdAt;
  final String updatedAt;

  bool get isActive => status == "queued" || status == "pending" || status == "processing";

  factory IngestionJob.fromJson(Map<String, dynamic> json) => IngestionJob(
    id: (json["id"] as num).toInt(),
    workspaceId: json["workspace_id"]?.toString() ?? "",
    sourceId: json["source_id"]?.toString() ?? "",
    status: json["status"] as String? ?? "queued",
    totalLines: (json["total_lines"] as num?)?.toInt() ?? 0,
    processedLines: (json["processed_lines"] as num?)?.toInt() ?? 0,
    queuePosition: (json["queue_position"] as num?)?.toInt() ?? 0,
    createdAt: json["created_at"] as String? ?? "",
    updatedAt: json["updated_at"] as String? ?? "",
  );

  Map<String, dynamic> toJson() => {
    "id": id,
    "workspace_id": workspaceId,
    "source_id": sourceId,
    "status": status,
    "total_lines": totalLines,
    "processed_lines": processedLines,
    "queue_position": queuePosition,
    "created_at": createdAt,
    "updated_at": updatedAt,
  };

  IngestionJob copyWith({
    int? id,
    String? workspaceId,
    String? sourceId,
    String? status,
    int? totalLines,
    int? processedLines,
    int? queuePosition,
    String? createdAt,
    String? updatedAt,
  }) {
    return IngestionJob(
      id: id ?? this.id,
      workspaceId: workspaceId ?? this.workspaceId,
      sourceId: sourceId ?? this.sourceId,
      status: status ?? this.status,
      totalLines: totalLines ?? this.totalLines,
      processedLines: processedLines ?? this.processedLines,
      queuePosition: queuePosition ?? this.queuePosition,
      createdAt: createdAt ?? this.createdAt,
      updatedAt: updatedAt ?? this.updatedAt,
    );
  }
}
