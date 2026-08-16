import "package:flutter/material.dart";
import "package:flutter_riverpod/flutter_riverpod.dart";
import "package:flutter_test/flutter_test.dart";

import "package:loglensai/models/ai_session.dart";
import "package:loglensai/providers/ai_provider.dart";
import "package:loglensai/providers/workspace_provider.dart";
import "package:loglensai/services/sidecar_bridge.dart";
import "package:loglensai/theme/app_theme.dart";
import "package:loglensai/widgets/organisms/ai_investigation_sidebar.dart";

/// Fake [AiNotifier] that never touches a real [SidecarBridge] -- overrides
/// every method the widget calls with an in-memory stand-in and records
/// what was invoked, so tests can assert on `sendMessage`/`stopMessage`
/// calls without a live sidecar.
class _FakeAiNotifier extends AiNotifier {
  _FakeAiNotifier(AiState initial) : super(SidecarBridge()) {
    state = initial;
  }

  final List<SendMessageParams> sendMessageCalls = [];
  bool stopMessageCalled = false;

  @override
  Future<void> sendMessage(SendMessageParams params) async {
    sendMessageCalls.add(params);
  }

  @override
  Future<void> stopMessage() async {
    stopMessageCalled = true;
    state = state.copyWith(isLoading: false);
  }

  @override
  Future<void> fetchSessions(String workspaceId) async {
    // No-op: avoid a real sidecar round-trip from the widget's mount-time
    // fetch effect.
  }

  @override
  void setSession(String? sessionId) {
    state = state.copyWith(currentSessionId: sessionId);
  }
}

ProviderContainer _buildContainer(AiState aiState) {
  return ProviderContainer(
    overrides: [
      aiProvider.overrideWith((ref) => _FakeAiNotifier(aiState)),
      // Pure-local methods only (addWorkspace never touches the bridge), so
      // a real SidecarBridge is safe to construct here -- it's simply never
      // called.
      workspaceProvider.overrideWith(
        (ref) => WorkspaceNotifier(SidecarBridge())
          ..addWorkspace(id: "ws1", name: "Test Workspace"),
      ),
    ],
  );
}

Widget _wrap(ProviderContainer container, Widget child) {
  return UncontrolledProviderScope(
    container: container,
    child: MaterialApp(theme: AppTheme.dark, home: Scaffold(body: child)),
  );
}

AiMessage _userMsg({int id = 1, String content = "What happened at 3am?"}) => AiMessage(
  id: id,
  sessionId: "s1",
  role: "user",
  content: content,
  timestamp: DateTime(2026, 1, 1, 9, 30).toIso8601String(),
);

AiMessage _assistantMsg({int id = 2, String content = "Here's what I found."}) => AiMessage(
  id: id,
  sessionId: "s1",
  role: "assistant",
  content: content,
  timestamp: DateTime(2026, 1, 1, 9, 31).toIso8601String(),
);

void main() {
  testWidgets("renders nothing when the sidebar is closed", (tester) async {
    final container = _buildContainer(const AiState(isSidebarOpen: false));
    addTearDown(container.dispose);

    await tester.pumpWidget(_wrap(container, const AIInvestigationSidebar()));

    expect(find.text("Investigation Hub"), findsNothing);
    expect(find.byKey(const Key("aiSidebarInputField")), findsNothing);
  });

  testWidgets("user vs assistant message bubbles use different styling", (tester) async {
    final container = _buildContainer(
      AiState(isSidebarOpen: true, messages: [_userMsg(), _assistantMsg()]),
    );
    addTearDown(container.dispose);

    await tester.pumpWidget(_wrap(container, const AIInvestigationSidebar()));
    await tester.pump();

    final userBubble = tester.widget<Container>(find.byKey(const Key("aiMessageBubble_1")));
    final assistantBubble = tester.widget<Container>(find.byKey(const Key("aiMessageBubble_2")));

    final userColor = (userBubble.decoration as BoxDecoration).color;
    final assistantColor = (assistantBubble.decoration as BoxDecoration).color;

    expect(userColor, AppColors.bgSurface);
    expect(assistantColor, AppColors.bgApp);
    expect(userColor, isNot(equals(assistantColor)));

    // User content renders as plain right-aligned text; assistant content
    // renders through MarkdownContent -- so the raw assistant string should
    // not appear verbatim as a direct Text widget the way the user's does.
    expect(find.text(_userMsg().content), findsOneWidget);
  });

  testWidgets("shows the typing indicator while the last assistant message is empty and loading", (
    tester,
  ) async {
    final container = _buildContainer(
      AiState(
        isSidebarOpen: true,
        isLoading: true,
        messages: [_userMsg(), _assistantMsg(id: 2, content: "")],
      ),
    );
    addTearDown(container.dispose);

    await tester.pumpWidget(_wrap(container, const AIInvestigationSidebar()));
    await tester.pump();

    expect(find.text("thinking…"), findsOneWidget);
  });

  testWidgets("dragging the resize handle updates sidebarWidth", (tester) async {
    final container = _buildContainer(const AiState(isSidebarOpen: true));
    addTearDown(container.dispose);

    await tester.pumpWidget(_wrap(container, const AIInvestigationSidebar()));
    await tester.pump();

    expect(container.read(aiProvider).sidebarWidth, 450);

    // Panel is right-docked; dragging the left-edge handle *left* (negative
    // dx) should grow the panel width by the same amount.
    await tester.drag(find.byKey(const Key("aiSidebarResizeHandle")), const Offset(-50, 0));
    await tester.pump();

    expect(container.read(aiProvider).sidebarWidth, 500);
  });

  testWidgets("resize is clamped between 320 and 800", (tester) async {
    final container = _buildContainer(const AiState(isSidebarOpen: true, sidebarWidth: 330));
    addTearDown(container.dispose);

    await tester.pumpWidget(_wrap(container, const AIInvestigationSidebar()));
    await tester.pump();

    await tester.drag(find.byKey(const Key("aiSidebarResizeHandle")), const Offset(500, 0));
    await tester.pump();

    expect(container.read(aiProvider).sidebarWidth, 320);
  });

  testWidgets("typing a message and tapping send triggers sendMessage with the composed params", (
    tester,
  ) async {
    final container = _buildContainer(const AiState(isSidebarOpen: true));
    addTearDown(container.dispose);

    await tester.pumpWidget(_wrap(container, const AIInvestigationSidebar()));
    await tester.pump();

    await tester.enterText(find.byKey(const Key("aiSidebarInputField")), "Investigate spike");
    await tester.pump();

    await tester.tap(find.byKey(const Key("aiSidebarSendButton")));
    await tester.pump();

    final fake = container.read(aiProvider.notifier) as _FakeAiNotifier;
    expect(fake.sendMessageCalls, hasLength(1));
    expect(fake.sendMessageCalls.single.message, "Investigate spike");
    expect(fake.sendMessageCalls.single.workspaceId, "ws1");
    expect(fake.sendMessageCalls.single.reasoning, isTrue);

    // Input is cleared optimistically after send, mirroring the React
    // source clearing `inputValue` before awaiting the stream.
    final field = tester.widget<TextField>(find.byKey(const Key("aiSidebarInputField")));
    expect(field.controller!.text, "");
  });

  testWidgets("send button is disabled while the input is empty", (tester) async {
    final container = _buildContainer(const AiState(isSidebarOpen: true));
    addTearDown(container.dispose);

    await tester.pumpWidget(_wrap(container, const AIInvestigationSidebar()));
    await tester.pump();

    await tester.tap(find.byKey(const Key("aiSidebarSendButton")));
    await tester.pump();

    final fake = container.read(aiProvider.notifier) as _FakeAiNotifier;
    expect(fake.sendMessageCalls, isEmpty);
  });

  testWidgets("tapping stop while streaming triggers stopMessage", (tester) async {
    final container = _buildContainer(const AiState(isSidebarOpen: true, isLoading: true));
    addTearDown(container.dispose);

    await tester.pumpWidget(_wrap(container, const AIInvestigationSidebar()));
    await tester.pump();

    expect(find.byKey(const Key("aiSidebarStopButton")), findsOneWidget);
    expect(find.byKey(const Key("aiSidebarSendButton")), findsNothing);

    await tester.tap(find.byKey(const Key("aiSidebarStopButton")));
    await tester.pump();

    final fake = container.read(aiProvider.notifier) as _FakeAiNotifier;
    expect(fake.stopMessageCalled, isTrue);
  });

  testWidgets("closing the sidebar calls setSidebarOpen(false)", (tester) async {
    final container = _buildContainer(const AiState(isSidebarOpen: true));
    addTearDown(container.dispose);

    await tester.pumpWidget(_wrap(container, const AIInvestigationSidebar()));
    await tester.pump();

    await tester.tap(find.byKey(const Key("aiSidebarCloseButton")));
    await tester.pump();

    expect(container.read(aiProvider).isSidebarOpen, isFalse);
  });

  testWidgets("empty state lists recent sessions and starting one opens it", (tester) async {
    final container = _buildContainer(
      AiState(
        isSidebarOpen: true,
        sessions: [
          const AiSession(
            sessionId: "s1",
            name: "Auth failures",
            createdAt: "2026-01-01T00:00:00.000Z",
            lastModified: "2026-01-01T00:00:00.000Z",
          ),
        ],
      ),
    );
    addTearDown(container.dispose);

    await tester.pumpWidget(_wrap(container, const AIInvestigationSidebar()));
    await tester.pump();

    expect(find.text("AI Investigator Ready"), findsOneWidget);
    expect(find.text("Auth failures"), findsOneWidget);

    await tester.tap(find.text("Auth failures"));
    await tester.pump();

    expect(container.read(aiProvider).currentSessionId, "s1");
  });
}
