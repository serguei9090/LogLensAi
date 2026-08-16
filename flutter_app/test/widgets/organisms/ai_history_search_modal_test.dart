import "package:flutter/material.dart";
import "package:flutter_riverpod/flutter_riverpod.dart";
import "package:flutter_test/flutter_test.dart";

import "package:loglensai/models/ai_session.dart";
import "package:loglensai/providers/ai_provider.dart";
import "package:loglensai/providers/workspace_provider.dart";
import "package:loglensai/services/sidecar_bridge.dart";
import "package:loglensai/theme/app_theme.dart";
import "package:loglensai/widgets/organisms/ai_history_search_modal.dart";

/// Fake [AiNotifier] that never touches a real [SidecarBridge] -- mirrors
/// the pattern used by `ai_investigation_sidebar_test.dart`.
class _FakeAiNotifier extends AiNotifier {
  _FakeAiNotifier(AiState initial) : super(SidecarBridge()) {
    state = initial;
  }

  String? lastSetSessionId;
  final List<String> deleteCalls = [];

  @override
  void setSession(String? sessionId) {
    lastSetSessionId = sessionId;
    state = state.copyWith(currentSessionId: sessionId);
  }

  @override
  Future<void> deleteSession(String sessionId, String workspaceId) async {
    deleteCalls.add(sessionId);
    state = state.copyWith(
      sessions: state.sessions.where((s) => s.sessionId != sessionId).toList(),
    );
  }
}

AiSession _session(String id, String name, {String modified = "2026-01-01T09:30:00.000Z"}) =>
    AiSession(sessionId: id, name: name, createdAt: modified, lastModified: modified);

ProviderContainer _buildContainer({
  required List<AiSession> sessions,
  String? currentSessionId,
  bool withActiveWorkspace = true,
}) {
  return ProviderContainer(
    overrides: [
      aiProvider.overrideWith(
        (ref) => _FakeAiNotifier(
          AiState(sessions: sessions, currentSessionId: currentSessionId),
        ),
      ),
      workspaceProvider.overrideWith((ref) {
        final notifier = WorkspaceNotifier(SidecarBridge());
        if (withActiveWorkspace) {
          notifier.addWorkspace(id: "ws1", name: "Test Workspace");
        }
        return notifier;
      }),
    ],
  );
}

Widget _wrap(ProviderContainer container, Widget child) {
  return UncontrolledProviderScope(
    container: container,
    child: MaterialApp(theme: AppTheme.dark, home: Scaffold(body: child)),
  );
}

void main() {
  testWidgets("renders all sessions and the search field", (tester) async {
    final container = _buildContainer(
      sessions: [_session("s1", "Auth failures"), _session("s2", "Payment errors")],
    );
    addTearDown(container.dispose);

    await tester.pumpWidget(_wrap(container, AIHistorySearchModal(onClose: () {})));
    await tester.pump();

    expect(find.text("Auth failures"), findsOneWidget);
    expect(find.text("Payment errors"), findsOneWidget);
    expect(find.text("2 SESSIONS FOUND"), findsOneWidget);
  });

  testWidgets("typing filters sessions by name (case-insensitive)", (tester) async {
    final container = _buildContainer(
      sessions: [_session("s1", "Auth failures"), _session("s2", "Payment errors")],
    );
    addTearDown(container.dispose);

    await tester.pumpWidget(_wrap(container, AIHistorySearchModal(onClose: () {})));
    await tester.enterText(find.byType(TextField), "payment");
    await tester.pump();

    expect(find.text("Payment errors"), findsOneWidget);
    expect(find.text("Auth failures"), findsNothing);
    expect(find.text("1 SESSIONS FOUND"), findsOneWidget);
  });

  testWidgets("no matches shows the empty message", (tester) async {
    final container = _buildContainer(sessions: [_session("s1", "Auth failures")]);
    addTearDown(container.dispose);

    await tester.pumpWidget(_wrap(container, AIHistorySearchModal(onClose: () {})));
    await tester.enterText(find.byType(TextField), "nonexistent");
    await tester.pump();

    expect(find.text("No matching investigations found."), findsOneWidget);
  });

  testWidgets("selecting a session opens it and closes the modal", (tester) async {
    final container = _buildContainer(sessions: [_session("s1", "Auth failures")]);
    addTearDown(container.dispose);

    var closed = false;
    await tester.pumpWidget(
      _wrap(container, AIHistorySearchModal(onClose: () => closed = true)),
    );
    await tester.pump();

    await tester.tap(find.text("Auth failures"));
    await tester.pump();

    final fake = container.read(aiProvider.notifier) as _FakeAiNotifier;
    expect(fake.lastSetSessionId, "s1");
    expect(container.read(aiProvider).isSidebarOpen, isTrue);
    expect(closed, isTrue);
  });

  testWidgets("delete button removes the session when a workspace is active", (tester) async {
    final container = _buildContainer(sessions: [_session("s1", "Auth failures")]);
    addTearDown(container.dispose);

    await tester.pumpWidget(_wrap(container, AIHistorySearchModal(onClose: () {})));
    await tester.pump();

    expect(find.byIcon(Icons.delete_outline), findsOneWidget);
    await tester.tap(find.byIcon(Icons.delete_outline));
    await tester.pump();

    final fake = container.read(aiProvider.notifier) as _FakeAiNotifier;
    expect(fake.deleteCalls, ["s1"]);
    expect(find.text("Auth failures"), findsNothing);
  });

  testWidgets("delete button is hidden with no active workspace", (tester) async {
    final container = _buildContainer(
      sessions: [_session("s1", "Auth failures")],
      withActiveWorkspace: false,
    );
    addTearDown(container.dispose);

    await tester.pumpWidget(_wrap(container, AIHistorySearchModal(onClose: () {})));
    await tester.pump();

    expect(find.byIcon(Icons.delete_outline), findsNothing);
  });

  testWidgets("the active session is visually distinguished", (tester) async {
    final container = _buildContainer(
      sessions: [_session("s1", "Auth failures")],
      currentSessionId: "s1",
    );
    addTearDown(container.dispose);

    await tester.pumpWidget(_wrap(container, AIHistorySearchModal(onClose: () {})));
    await tester.pump();

    final text = tester.widget<Text>(find.text("Auth failures"));
    expect(text.style?.color, AppColors.primary);
  });
}
