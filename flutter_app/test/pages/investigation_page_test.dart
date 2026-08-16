// Widget tests for the real `InvestigationPage` (Phase 5 page-wiring pass).
//
// Verifies: the toolbar/panels compose correctly, ExplorerView shows when no
// source is active, VirtualLogTable shows when one is, and the toolbar's
// "Import" action opens the always-mounted ImportFeedModal. All RPC traffic
// goes through a [_FakeBridge] so no real sidecar process or HTTP call is
// ever attempted, mirroring `settings_page_test.dart`/`dashboard_page_test
// .dart`'s established fake-bridge pattern for this codebase.

import "package:flutter/material.dart";
import "package:flutter_riverpod/flutter_riverpod.dart";
import "package:flutter_test/flutter_test.dart";

import "package:loglensai/models/workspace.dart";
import "package:loglensai/pages/investigation_page.dart";
import "package:loglensai/providers/sidecar_provider.dart";
import "package:loglensai/providers/workspace_provider.dart";
import "package:loglensai/services/sidecar_bridge.dart";
import "package:loglensai/theme/app_theme.dart";
import "package:loglensai/widgets/organisms/ai_investigation_sidebar.dart";
import "package:loglensai/widgets/organisms/column_manager_sidebar.dart";
import "package:loglensai/widgets/organisms/explorer_view.dart";
import "package:loglensai/widgets/organisms/facet_sidebar.dart";
import "package:loglensai/widgets/organisms/log_toolbar.dart";
import "package:loglensai/widgets/organisms/virtual_log_table.dart";

/// Fake [SidecarBridge] that answers every RPC this page's mount-time
/// fetches can issue (`get_settings`, `get_logs`/`get_fused_logs`,
/// `get_time_boundaries`, `get_anomalies`, `get_metadata_facets`) in-memory
/// and instantly, matching `settings_page_test.dart`'s `_FakeBridge`.
class _FakeBridge extends SidecarBridge {
  final List<String> calledMethods = [];

  @override
  Future<T> call<T>(String method, [Map<String, dynamic> params = const {}]) async {
    calledMethods.add(method);
    switch (method) {
      case "get_logs":
      case "get_fused_logs":
        return <String, dynamic>{"logs": <dynamic>[], "total": 0} as T;
      case "get_anomalies":
        return <String, dynamic>{"anomalies": <dynamic>[]} as T;
      default:
        return <String, dynamic>{} as T;
    }
  }
}

/// Fake [WorkspaceNotifier] that starts from a caller-supplied [initial]
/// state and never touches the real bridge for `fetchHierarchy` (unlike
/// `addWorkspace`, that method awaits `get_hierarchy` with no error
/// handling of its own), mirroring `sidebar_test.dart`'s
/// `_FakeWorkspaceNotifier`.
class _FakeWorkspaceNotifier extends WorkspaceNotifier {
  _FakeWorkspaceNotifier(WorkspaceState initial, SidecarBridge bridge) : super(bridge) {
    state = initial;
  }

  @override
  Future<void> fetchHierarchy(String workspaceId) async {}
}

ProviderContainer _buildContainer({Workspace? workspace}) {
  final bridge = _FakeBridge();
  final wsState = workspace == null
      ? const WorkspaceState()
      : WorkspaceState(workspaces: [workspace], activeWorkspaceId: workspace.id);
  return ProviderContainer(
    overrides: [
      sidecarBridgeProvider.overrideWithValue(bridge),
      workspaceProvider.overrideWith((ref) => _FakeWorkspaceNotifier(wsState, bridge)),
    ],
  );
}

Widget _wrap(ProviderContainer container) {
  return UncontrolledProviderScope(
    container: container,
    child: MaterialApp(theme: AppTheme.dark, home: const Scaffold(body: InvestigationPage())),
  );
}

void main() {
  // The full toolbar row (import/export/orchestrate, facet/column icons,
  // tail switch, search bar, time-range picker, filter/highlight builders,
  // columns/template menus, AI toggle) plus the facet/column/AI side panels
  // are wider than the default 800px test surface, matching
  // `log_toolbar_test.dart`'s setup.
  setUp(() {
    final binding = TestWidgetsFlutterBinding.ensureInitialized();
    binding.platformDispatcher.views.first.physicalSize = const Size(1600, 900);
    binding.platformDispatcher.views.first.devicePixelRatio = 1.0;
  });
  tearDown(() {
    final binding = TestWidgetsFlutterBinding.ensureInitialized();
    binding.platformDispatcher.views.first.resetPhysicalSize();
    binding.platformDispatcher.views.first.resetDevicePixelRatio();
  });

  testWidgets("with no active workspace, renders the toolbar/panels and ExplorerView, not VirtualLogTable", (
    tester,
  ) async {
    final container = _buildContainer();
    addTearDown(container.dispose);

    await tester.pumpWidget(_wrap(container));
    await _settle(tester);

    expect(find.byType(LogToolbar), findsOneWidget);
    expect(find.byType(FacetSidebar), findsOneWidget);
    expect(find.byType(ColumnManagerSidebar), findsOneWidget);
    expect(find.byType(AIInvestigationSidebar), findsOneWidget);
    expect(find.byType(ExplorerView), findsOneWidget);
    expect(find.byType(VirtualLogTable), findsNothing);
    expect(find.text("Import"), findsOneWidget);
  });

  testWidgets("with an active source, renders VirtualLogTable instead of ExplorerView", (tester) async {
    final workspace = Workspace(
      id: "ws1",
      name: "Prod",
      sources: const [LogSource(id: "src1", name: "app.log", type: "local", path: "/var/log/app.log")],
      activeSourceId: "src1",
      createdAt: DateTime.now().toIso8601String(),
    );
    final container = _buildContainer(workspace: workspace);
    addTearDown(container.dispose);

    await tester.pumpWidget(_wrap(container));
    await _settle(tester);

    expect(find.byType(VirtualLogTable), findsOneWidget);
    expect(find.byType(ExplorerView), findsNothing);
    // Confirms the mount-time full fetch (get_logs + get_metadata_facets +
    // get_time_boundaries) actually fired against the active source.
    final bridge = container.read(sidecarBridgeProvider) as _FakeBridge;
    expect(bridge.calledMethods, contains("get_logs"));
    expect(bridge.calledMethods, contains("get_metadata_facets"));
  });

  testWidgets("tapping Import opens the always-mounted ImportFeedModal", (tester) async {
    final container = _buildContainer();
    addTearDown(container.dispose);

    await tester.pumpWidget(_wrap(container));
    await _settle(tester);

    expect(find.text("Ingest Source"), findsNothing);
    await tester.tap(find.text("Import"));
    await _settle(tester);

    expect(find.text("Ingest Source"), findsOneWidget);
  });
}

/// Flushes the mount-time async RPC chain (`_fetchLogs`'s `Future.wait`)
/// without `pumpAndSettle` -- `LogToolbar` always mounts a [StatusDot] whose
/// `active: true` state (this page's `_isConnected` default) drives an
/// infinitely-repeating ping animation, which `pumpAndSettle` never
/// considers settled. Matches `log_toolbar_test.dart`/
/// `import_feed_modal_test.dart`'s established `tester.pump()`-only
/// convention for pages/organisms that mount an active [StatusDot].
Future<void> _settle(WidgetTester tester) async {
  await tester.pump();
  await tester.pump(const Duration(milliseconds: 50));
  await tester.pump();
}
