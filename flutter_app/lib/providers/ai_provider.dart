/// Port of `src/store/aiStore.ts` (`useAiStore`).
library;

import "dart:async";
import "dart:convert";

import "package:flutter_riverpod/flutter_riverpod.dart";
import "package:http/http.dart" as http;

import "../models/ai_session.dart";
import "../services/sidecar_bridge.dart";
import "sidecar_provider.dart";

class SendMessageParams {
  const SendMessageParams({
    required this.workspaceId,
    required this.message,
    this.contextLogs,
    this.model,
    this.sessionName,
    this.reasoning,
  });

  final String workspaceId;
  final String message;
  final List<int>? contextLogs;
  final String? model;
  final String? sessionName;
  final bool? reasoning;
}

class AiState {
  const AiState({
    this.currentSessionId,
    this.sessions = const [],
    this.messages = const [],
    this.isLoading = false,
    this.isSidebarOpen = false,
    this.sidebarWidth = 450,
    this.error,
    this.logSessionMap = const {},
    this.dashboardWidgets = const [],
  });

  final String? currentSessionId;
  final List<AiSession> sessions;
  final List<AiMessage> messages;
  final bool isLoading;
  final bool isSidebarOpen;
  final double sidebarWidth;
  final String? error;

  /// log_id -> session_id
  final Map<int, String> logSessionMap;

  /// A2UI payloads pinned to the dashboard.
  final List<Map<String, dynamic>> dashboardWidgets;

  AiState copyWith({
    Object? currentSessionId = _unset,
    List<AiSession>? sessions,
    List<AiMessage>? messages,
    bool? isLoading,
    bool? isSidebarOpen,
    double? sidebarWidth,
    Object? error = _unset,
    Map<int, String>? logSessionMap,
    List<Map<String, dynamic>>? dashboardWidgets,
  }) {
    return AiState(
      currentSessionId: identical(currentSessionId, _unset)
          ? this.currentSessionId
          : currentSessionId as String?,
      sessions: sessions ?? this.sessions,
      messages: messages ?? this.messages,
      isLoading: isLoading ?? this.isLoading,
      isSidebarOpen: isSidebarOpen ?? this.isSidebarOpen,
      sidebarWidth: sidebarWidth ?? this.sidebarWidth,
      error: identical(error, _unset) ? this.error : error as String?,
      logSessionMap: logSessionMap ?? this.logSessionMap,
      dashboardWidgets: dashboardWidgets ?? this.dashboardWidgets,
    );
  }
}

const Object _unset = Object();

class AiNotifier extends StateNotifier<AiState> {
  AiNotifier(this._bridge) : super(const AiState());

  final SidecarBridge _bridge;
  StreamSubscription<String>? _streamSub;

  void setSidebarOpen(bool open) => state = state.copyWith(isSidebarOpen: open);
  void setSidebarWidth(double width) => state = state.copyWith(sidebarWidth: width);

  void setSession(String? sessionId) {
    state = state.copyWith(currentSessionId: sessionId);
    if (sessionId != null) {
      unawaited(fetchMessages(sessionId));
    } else {
      state = state.copyWith(messages: const []);
    }
  }

  Future<void> fetchSessions(String workspaceId) async {
    try {
      final raw = await _bridge.call<List<dynamic>>(
        "get_ai_sessions",
        {"workspace_id": workspaceId},
      );
      state = state.copyWith(
        sessions: raw.map((s) => AiSession.fromJson(s as Map<String, dynamic>)).toList(),
      );
    } catch (e) {
      state = state.copyWith(error: e.toString());
    }
  }

  Future<void> fetchMapping(String workspaceId) async {
    try {
      final raw = await _bridge.call<Map<String, dynamic>>(
        "get_ai_mapping",
        {"workspace_id": workspaceId},
      );
      state = state.copyWith(
        logSessionMap: raw.map((k, v) => MapEntry(int.parse(k), v.toString())),
      );
    } catch (_) {
      // Mirror TS: log-and-continue.
    }
  }

  Future<void> renameSession(String sessionId, String name, String workspaceId) async {
    try {
      await _bridge.call("rename_ai_session", {"session_id": sessionId, "name": name});
      await fetchSessions(workspaceId);
    } catch (e) {
      state = state.copyWith(error: e.toString());
    }
  }

  Future<void> deleteSession(String sessionId, String workspaceId) async {
    try {
      await _bridge.call("delete_ai_session", {"session_id": sessionId});
      if (state.currentSessionId == sessionId) {
        state = state.copyWith(currentSessionId: null, messages: const []);
      }
      await fetchSessions(workspaceId);
      await fetchMapping(workspaceId);
    } catch (e) {
      state = state.copyWith(error: e.toString());
    }
  }

  Future<void> fetchMessages(String sessionId) async {
    state = state.copyWith(isLoading: true);
    try {
      final raw = await _bridge.call<List<dynamic>>(
        "get_ai_messages",
        {"session_id": sessionId},
      );
      state = state.copyWith(
        messages: raw.map((m) => AiMessage.fromJson(m as Map<String, dynamic>)).toList(),
        isLoading: false,
      );
    } catch (e) {
      state = state.copyWith(error: e.toString(), isLoading: false);
    }
  }

  /// Streams a chat response from `POST {httpOrigin}/api/stream_chat`
  /// (SSE), mirroring `aiStore.ts`'s `sendMessage`. Appends optimistic
  /// user+assistant placeholder messages, then patches the assistant
  /// message's content as `data: {"chunk": "..."}` events arrive.
  Future<void> sendMessage(SendMessageParams params) async {
    await _streamSub?.cancel();

    var sessionId = state.currentSessionId;
    state = state.copyWith(isLoading: true, error: null);

    final userMsg = AiMessage(
      id: DateTime.now().millisecondsSinceEpoch,
      sessionId: sessionId ?? "temp",
      role: "user",
      content: params.message,
      contextLogs: params.contextLogs,
      timestamp: DateTime.now().toIso8601String(),
    );
    final assistantMsg = AiMessage(
      id: DateTime.now().millisecondsSinceEpoch + 1,
      sessionId: sessionId ?? "temp",
      role: "assistant",
      content: "",
      timestamp: DateTime.now().toIso8601String(),
    );
    state = state.copyWith(messages: [...state.messages, userMsg, assistantMsg]);

    try {
      final request = http.Request(
        "POST",
        Uri.parse("${_bridge.httpOrigin}/api/stream_chat"),
      )
        ..headers["Content-Type"] = "application/json"
        ..headers["Accept"] = "text/event-stream"
        ..body = jsonEncode({
          "workspace_id": params.workspaceId,
          "message": params.message,
          if (params.contextLogs != null) "context_logs": params.contextLogs,
          if (params.model != null) "model": params.model,
          if (params.sessionName != null) "session_name": params.sessionName,
          if (params.reasoning != null) "reasoning": params.reasoning,
          "session_id": sessionId,
        });

      final streamed = await _bridge.httpClient.send(request);

      final completer = Completer<void>();
      String buffer = "";

      _streamSub = streamed.stream.transform(utf8.decoder).listen(
        (chunk) {
          buffer += chunk;
          final parts = buffer.split("\n\n");
          buffer = parts.removeLast();
          for (final line in parts) {
            if (!line.startsWith("data: ")) continue;
            final dataStr = line.substring(6).trim();
            if (dataStr == "[DONE]") continue;
            try {
              final parsed = jsonDecode(dataStr) as Map<String, dynamic>;
              if (parsed["error"] != null) {
                state = state.copyWith(error: parsed["error"].toString());
                continue;
              }
              if (parsed["session_id"] != null && sessionId == null) {
                sessionId = parsed["session_id"] as String;
                state = state.copyWith(currentSessionId: sessionId);
              }
              if (parsed["chunk"] != null) {
                final msgs = List<AiMessage>.from(state.messages);
                if (msgs.isNotEmpty) {
                  final last = msgs.last;
                  msgs[msgs.length - 1] = last.copyWith(
                    content: last.content + (parsed["chunk"] as String),
                    sessionId: sessionId ?? last.sessionId,
                  );
                }
                state = state.copyWith(messages: msgs);
              }
              if (parsed["a2ui_payload"] != null) {
                final msgs = List<AiMessage>.from(state.messages);
                if (msgs.isNotEmpty) {
                  msgs[msgs.length - 1] = msgs.last.copyWith(
                    a2uiPayload: parsed["a2ui_payload"] as Map<String, dynamic>,
                  );
                }
                state = state.copyWith(messages: msgs);
              }
            } catch (_) {
              // Malformed chunk -- mirror TS's console.warn-and-continue.
            }
          }
        },
        onDone: () => completer.complete(),
        onError: completer.completeError,
        cancelOnError: true,
      );

      await completer.future;
      state = state.copyWith(isLoading: false);

      final resolvedSessionId = sessionId;
      if (resolvedSessionId != null) {
        await fetchSessions(params.workspaceId);
        await fetchMapping(params.workspaceId);
        await fetchMessages(resolvedSessionId);
      }
    } catch (e) {
      state = state.copyWith(error: e.toString(), isLoading: false);
    }
  }

  Future<void> stopMessage() async {
    await _streamSub?.cancel();
    _streamSub = null;
    state = state.copyWith(isLoading: false);
  }

  void clearError() => state = state.copyWith(error: null);

  void addDashboardWidget(Map<String, dynamic> widget) {
    state = state.copyWith(dashboardWidgets: [...state.dashboardWidgets, widget]);
  }

  void clearDashboardWidgets() => state = state.copyWith(dashboardWidgets: const []);

  @override
  void dispose() {
    _streamSub?.cancel();
    super.dispose();
  }
}

final aiProvider = StateNotifierProvider<AiNotifier, AiState>((ref) {
  return AiNotifier(ref.watch(sidecarBridgeProvider));
});
