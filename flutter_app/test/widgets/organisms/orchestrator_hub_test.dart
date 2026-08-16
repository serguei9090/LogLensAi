import "package:flutter/material.dart";
import "package:flutter_riverpod/flutter_riverpod.dart";
import "package:flutter_test/flutter_test.dart";

import "package:loglensai/models/workspace.dart";
import "package:loglensai/providers/clustering_provider.dart";
import "package:loglensai/providers/investigation_provider.dart";
import "package:loglensai/providers/workspace_provider.dart";
import "package:loglensai/services/sidecar_bridge.dart";
import "package:loglensai/theme/app_theme.dart";
import "package:loglensai/widgets/organisms/orchestrator_hub.dart";

/// Fake [ClusteringNotifier] that never touches a real [SidecarBridge] --
/// `OrchestratorHub` fires-and-forgets a `fetchStatus` call on open, which
/// otherwise leaves a real bridge's pending HTTP-fallback timer dangling
/// past test teardown (flaky "Timer still pending" failures when run
/// alongside the rest of the suite), mirroring this file's
/// `_FakeWorkspaceNotifier` pattern.
class _FakeClusteringNotifier extends ClusteringNotifier {
  _FakeClusteringNotifier() : super(SidecarBridge());

  @override
  Future<void> fetchStatus({String? workspaceId}) async {}

  @override
  Future<void> setPaused(bool paused, {String? workspaceId}) async {}
}

/// Fake [WorkspaceNotifier] backing the fusion/template/temporal-sync RPCs
/// `OrchestratorHub` calls, mirroring the `_FakeWorkspaceNotifier` pattern
/// used by `custom_parser_modal_test.dart` / `sidebar_test.dart`.
class _FakeWorkspaceNotifier extends WorkspaceNotifier {
  _FakeWorkspaceNotifier({
    this.fusionConfigResponse = const {"sources": <Map<String, dynamic>>[]},
    this.templates = const [],
    this.temporalOffsets = const {},
  }) : super(SidecarBridge());

  final Map<String, dynamic> fusionConfigResponse;
  final List<Map<String, dynamic>> templates;
  final Map<String, dynamic> temporalOffsets;

  final List<(String, List<Map<String, dynamic>>)> updateFusionConfigCalls = [];
  Map<String, dynamic>? lastTemporalOffsetsSaved;

  @override
  Future<Map<String, dynamic>> getFusionConfig(String workspaceId, String fusionId) async =>
      fusionConfigResponse;

  @override
  Future<void> updateFusionConfig(
    String workspaceId,
    String fusionId,
    List<Map<String, dynamic>> sources,
  ) async {
    updateFusionConfigCalls.add((fusionId, sources));
  }

  @override
  Future<List<Map<String, dynamic>>> getTemplates(String workspaceId) async => templates;

  @override
  Future<Map<String, dynamic>> getTemporalOffsets(String workspaceId) async => temporalOffsets;

  @override
  Future<void> updateTemporalOffsets(String workspaceId, Map<String, dynamic> offsets) async {
    lastTemporalOffsetsSaved = offsets;
  }
}

const _sources = [
  LogSource(id: "s1", name: "App A", type: "local", path: "/var/log/a.log"),
  LogSource(id: "s2", name: "App B", type: "local", path: "/var/log/b.log"),
];

ProviderContainer _buildContainer({_FakeWorkspaceNotifier? notifier}) {
  return ProviderContainer(
    overrides: [
      workspaceProvider.overrideWith((ref) => notifier ?? _FakeWorkspaceNotifier()),
      clusteringProvider.overrideWith((ref) => _FakeClusteringNotifier()),
    ],
  );
}

Widget _wrap(ProviderContainer container, Widget child) {
  return UncontrolledProviderScope(
    container: container,
    child: MaterialApp(theme: AppTheme.dark, home: Scaffold(body: SizedBox(height: 900, child: child))),
  );
}

void main() {
  // The drawer's content (picker sections, fusion-form source list,
  // temporal-sync rows) is taller than the default 800x600 test surface,
  // pushing lower items (e.g. the "Temporal Sync" strategy card) below the
  // visible/hit-testable area. Widen and heighten it, mirroring
  // `custom_parser_modal_test.dart`'s surface-resize setup.
  setUp(() {
    final binding = TestWidgetsFlutterBinding.ensureInitialized();
    binding.platformDispatcher.views.first.physicalSize = const Size(900, 1400);
    binding.platformDispatcher.views.first.devicePixelRatio = 1.0;
  });
  tearDown(() {
    final binding = TestWidgetsFlutterBinding.ensureInitialized();
    binding.platformDispatcher.views.first.resetPhysicalSize();
    binding.platformDispatcher.views.first.resetDevicePixelRatio();
  });

  testWidgets("renders nothing when isOpen is false", (tester) async {
    final container = _buildContainer();
    addTearDown(container.dispose);

    await tester.pumpWidget(
      _wrap(
        container,
        OrchestratorHub(
          isOpen: false,
          onClose: () {},
          workspaceId: "ws1",
          availableSources: _sources,
          onFusionSaved: (_, _, _) {},
        ),
      ),
    );

    expect(find.text("Orchestrator"), findsNothing);
  });

  testWidgets("picker view toggles the Log Distribution switch on investigationProvider", (tester) async {
    final container = _buildContainer();
    addTearDown(container.dispose);

    await tester.pumpWidget(
      _wrap(
        container,
        OrchestratorHub(
          isOpen: true,
          onClose: () {},
          workspaceId: "ws1",
          availableSources: _sources,
          onFusionSaved: (_, _, _) {},
        ),
      ),
    );
    await tester.pumpAndSettle();

    expect(find.text("Orchestrator"), findsOneWidget);
    expect(container.read(investigationProvider).showDistribution, isFalse);

    await tester.tap(find.byType(Switch).first);
    await tester.pump();

    expect(container.read(investigationProvider).showDistribution, isTrue);
  });

  testWidgets("the close button forwards to onClose", (tester) async {
    final container = _buildContainer();
    addTearDown(container.dispose);
    var closed = false;

    await tester.pumpWidget(
      _wrap(
        container,
        OrchestratorHub(
          isOpen: true,
          onClose: () => closed = true,
          workspaceId: "ws1",
          availableSources: _sources,
          onFusionSaved: (_, _, _) {},
        ),
      ),
    );
    await tester.pumpAndSettle();

    await tester.tap(find.byIcon(Icons.close));
    expect(closed, isTrue);
  });

  testWidgets("Log Fusion flow: Deploy is disabled below 2 sources, enabled once 2 are checked, and saves", (
    tester,
  ) async {
    final notifier = _FakeWorkspaceNotifier();
    final container = _buildContainer(notifier: notifier);
    addTearDown(container.dispose);
    String? savedFusionId;
    String? savedFusionName;

    await tester.pumpWidget(
      _wrap(
        container,
        OrchestratorHub(
          isOpen: true,
          onClose: () {},
          workspaceId: "ws1",
          availableSources: _sources,
          onFusionSaved: (id, name, configs) {
            savedFusionId = id;
            savedFusionName = name;
          },
        ),
      ),
    );
    await tester.pumpAndSettle();

    await tester.tap(find.text("Log Fusion"));
    await tester.pumpAndSettle();

    expect(find.text("App A"), findsOneWidget);
    expect(find.text("App B"), findsOneWidget);

    final deployButton = find.widgetWithText(ElevatedButton, "Deploy");
    expect(tester.widget<ElevatedButton>(deployButton).onPressed, isNull);

    await tester.tap(find.byKey(const Key("orchestratorSourceCheckbox_/var/log/a.log")));
    await tester.pump();
    expect(tester.widget<ElevatedButton>(deployButton).onPressed, isNull);

    await tester.tap(find.byKey(const Key("orchestratorSourceCheckbox_/var/log/b.log")));
    await tester.pump();
    expect(tester.widget<ElevatedButton>(deployButton).onPressed, isNotNull);

    await tester.enterText(find.byType(TextField).first, "Combined Feed");
    await tester.tap(deployButton);
    await tester.pumpAndSettle();

    expect(notifier.updateFusionConfigCalls, hasLength(1));
    expect(notifier.updateFusionConfigCalls.single.$2, hasLength(2));
    expect(savedFusionName, "Combined Feed");
    expect(savedFusionId, isNotNull);
  });

  testWidgets("editing an existing fusion loads its saved source config", (tester) async {
    final notifier = _FakeWorkspaceNotifier(
      fusionConfigResponse: {
        "sources": [
          {"source_id": "/var/log/a.log", "enabled": true, "tz_offset": 0},
          {"source_id": "/var/log/b.log", "enabled": false, "tz_offset": 0},
        ],
      },
    );
    final container = _buildContainer(notifier: notifier);
    addTearDown(container.dispose);

    await tester.pumpWidget(
      _wrap(
        container,
        OrchestratorHub(
          isOpen: true,
          onClose: () {},
          workspaceId: "ws1",
          availableSources: _sources,
          editingFusionId: "fusion_1",
          editingFusionName: "My Fusion",
          onFusionSaved: (_, _, _) {},
        ),
      ),
    );
    await tester.pumpAndSettle();

    // Jumps straight to the fusion-form view for an editing session.
    expect(find.text("App A"), findsOneWidget);
    expect(find.text("App B"), findsOneWidget);
    expect(find.byType(TextField).first, findsOneWidget);
    expect(tester.widget<TextField>(find.byType(TextField).first).controller!.text, "My Fusion");
  });

  testWidgets("Temporal Sync flow: Sync opens TimeShiftModal and Apply persists the offset", (tester) async {
    final notifier = _FakeWorkspaceNotifier();
    final container = _buildContainer(notifier: notifier);
    addTearDown(container.dispose);

    await tester.pumpWidget(
      _wrap(
        container,
        OrchestratorHub(
          isOpen: true,
          onClose: () {},
          workspaceId: "ws1",
          availableSources: _sources,
          onFusionSaved: (_, _, _) {},
        ),
      ),
    );
    await tester.pumpAndSettle();

    await tester.tap(find.text("Temporal Sync"));
    await tester.pumpAndSettle();

    expect(find.text("App A"), findsOneWidget);

    await tester.tap(find.byKey(const Key("orchestratorSyncButton_/var/log/a.log")));
    await tester.pumpAndSettle();

    expect(find.text("Time Alignment"), findsOneWidget);

    await tester.enterText(find.byType(TextFormField).at(0), "0");
    await tester.enterText(find.byType(TextFormField).at(3), "30");
    await tester.tap(find.text("Apply").last);
    await tester.pumpAndSettle();

    expect(find.text("+30s"), findsOneWidget);

    await tester.tap(find.widgetWithText(ElevatedButton, "Apply"));
    await tester.pumpAndSettle();

    expect(notifier.lastTemporalOffsetsSaved, {"/var/log/a.log": 30});
  });

  testWidgets("an enabled source with available templates shows the template picker", (tester) async {
    final notifier = _FakeWorkspaceNotifier(
      templates: const [
        {"id": 7, "name": "Apache Common Log", "config": "{}", "created_at": "2026-01-01"},
      ],
    );
    final container = _buildContainer(notifier: notifier);
    addTearDown(container.dispose);

    await tester.pumpWidget(
      _wrap(
        container,
        OrchestratorHub(
          isOpen: true,
          onClose: () {},
          workspaceId: "ws1",
          availableSources: _sources,
          onFusionSaved: (_, _, _) {},
        ),
      ),
    );
    await tester.pumpAndSettle();

    await tester.tap(find.text("Log Fusion"));
    await tester.pumpAndSettle();

    // No dropdown until the source is enabled.
    expect(find.text("Apply Template..."), findsNothing);

    await tester.tap(find.byKey(const Key("orchestratorSourceCheckbox_/var/log/a.log")));
    await tester.pumpAndSettle();

    expect(find.text("Apply Template..."), findsOneWidget);
  });

  testWidgets("Temporal Sync view seeds each row's offset from getTemporalOffsets", (tester) async {
    final notifier = _FakeWorkspaceNotifier(
      temporalOffsets: const {"/var/log/a.log": -45},
    );
    final container = _buildContainer(notifier: notifier);
    addTearDown(container.dispose);

    await tester.pumpWidget(
      _wrap(
        container,
        OrchestratorHub(
          isOpen: true,
          onClose: () {},
          workspaceId: "ws1",
          availableSources: _sources,
          onFusionSaved: (_, _, _) {},
        ),
      ),
    );
    await tester.pumpAndSettle();

    await tester.tap(find.text("Temporal Sync"));
    await tester.pumpAndSettle();

    expect(find.text("-45s"), findsOneWidget);
    // The second source has no saved offset -> defaults to "0s".
    expect(find.text("0s"), findsOneWidget);
  });

  testWidgets("Knowledge Base flow: Set opens the AI-context editor and Save persists it", (tester) async {
    final container = _buildContainer();
    addTearDown(container.dispose);

    await tester.pumpWidget(
      _wrap(
        container,
        OrchestratorHub(
          isOpen: true,
          onClose: () {},
          workspaceId: "ws1",
          availableSources: _sources,
          onFusionSaved: (_, _, _) {},
        ),
      ),
    );
    await tester.pumpAndSettle();

    await tester.tap(find.text("Set"));
    await tester.pumpAndSettle();

    await tester.enterText(find.byType(TextField).first, "Auth service uses JWT.");
    await tester.tap(find.widgetWithText(ElevatedButton, "Save"));
    await tester.pumpAndSettle();

    expect(container.read(investigationProvider).workspaceGlobalContext, "Auth service uses JWT.");
    expect(find.text("Cognition saved"), findsOneWidget);
  });
}
