/// Mirrors `src/store/aiStore.ts`'s `AiMessage` / `AiSession`.
library;

class AiMessage {
  const AiMessage({
    required this.id,
    required this.sessionId,
    required this.role,
    required this.content,
    this.a2uiPayload,
    this.contextLogs,
    required this.timestamp,
    this.providerSessionId,
  });

  final int id;
  final String sessionId;

  /// 'user' | 'assistant' | 'system'
  final String role;
  final String content;
  final Map<String, dynamic>? a2uiPayload;
  final List<int>? contextLogs;
  final String timestamp;
  final String? providerSessionId;

  factory AiMessage.fromJson(Map<String, dynamic> json) => AiMessage(
    id: (json["id"] as num).toInt(),
    sessionId: json["session_id"]?.toString() ?? "",
    role: json["role"] as String? ?? "assistant",
    content: json["content"] as String? ?? "",
    a2uiPayload: json["a2ui_payload"] as Map<String, dynamic>?,
    contextLogs: (json["context_logs"] as List<dynamic>?)
        ?.map((e) => (e as num).toInt())
        .toList(),
    timestamp: json["timestamp"] as String? ?? "",
    providerSessionId: json["provider_session_id"] as String?,
  );

  Map<String, dynamic> toJson() => {
    "id": id,
    "session_id": sessionId,
    "role": role,
    "content": content,
    if (a2uiPayload != null) "a2ui_payload": a2uiPayload,
    if (contextLogs != null) "context_logs": contextLogs,
    "timestamp": timestamp,
    if (providerSessionId != null) "provider_session_id": providerSessionId,
  };

  AiMessage copyWith({
    int? id,
    String? sessionId,
    String? role,
    String? content,
    Map<String, dynamic>? a2uiPayload,
    List<int>? contextLogs,
    String? timestamp,
    String? providerSessionId,
  }) {
    return AiMessage(
      id: id ?? this.id,
      sessionId: sessionId ?? this.sessionId,
      role: role ?? this.role,
      content: content ?? this.content,
      a2uiPayload: a2uiPayload ?? this.a2uiPayload,
      contextLogs: contextLogs ?? this.contextLogs,
      timestamp: timestamp ?? this.timestamp,
      providerSessionId: providerSessionId ?? this.providerSessionId,
    );
  }
}

class AiSession {
  const AiSession({
    required this.sessionId,
    required this.name,
    required this.createdAt,
    required this.lastModified,
    this.providerSessionId,
  });

  final String sessionId;
  final String name;
  final String createdAt;
  final String lastModified;
  final String? providerSessionId;

  factory AiSession.fromJson(Map<String, dynamic> json) => AiSession(
    sessionId: json["session_id"]?.toString() ?? "",
    name: json["name"] as String? ?? "",
    createdAt: json["created_at"] as String? ?? "",
    lastModified: json["last_modified"] as String? ?? "",
    providerSessionId: json["provider_session_id"] as String?,
  );
}
