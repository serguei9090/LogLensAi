// Smoke test for the real Phase 5 app shell: verifies the ProviderScope
// -wrapped MaterialApp launches, renders the real `Sidebar` organism plus
// the real `DashboardPage` by default, and selecting a workspace switches
// the main content over to the real `InvestigationPage`. All RPC traffic
// goes through a [_FakeBridge] so no real sidecar process or HTTP call is
// ever attempted, mirroring `settings_page_test.dart`/`dashboard_page_test
// .dart`'s established fake-bridge pattern for this codebase.

import "package:flutter/material.dart";
import "package:flutter_riverpod/flutter_riverpod.dart";
import "package:flutter_test/flutter_test.dart";

import "package:loglensai/app.dart";
import "package:loglensai/providers/sidecar_provider.dart";
import "package:loglensai/providers/workspace_provider.dart";
import "package:loglensai/services/sidecar_bridge.dart";
import "package:loglensai/widgets/organisms/log_toolbar.dart";
import "package:loglensai/widgets/organisms/sidebar.dart";

/// Fake [SidecarBridge] that answers every RPC the shell's mounted pages can
/// issue on mount (`get_settings`, `get_dashboard_stats`, `get_logs`,
/// `get_hierarchy`, ...) in-memory and instantly.
class _FakeBridge extends SidecarBridge {
  @override
  Future<T> call<T>(String method, [Map<String, dynamic> params = const {}]) async {
    switch (method) {
      case "get_logs":
      case "get_fused_logs":
        return <String, dynamic>{"logs": <dynamic>[], "total": 0} as T;
      case "get_anomalies":
        return <String, dynamic>{"anomalies": <dynamic>[]} as T;
      case "get_hierarchy":
        return <String, dynamic>{
              "root": {"id": "root", "name": "root", "type": "folder", "children": <dynamic>[], "sources": <dynamic>[]},
            }
            as T;
      default:
        return <String, dynamic>{} as T;
    }
  }
}

/// Fake [WorkspaceNotifier] preloaded with one workspace so the Sidebar has
/// a row to tap, and whose `fetchHierarchy` is a no-op (unlike
/// `addWorkspace`, that method awaits `get_hierarchy` for real) --
/// mirrors `sidebar_test.dart`'s `_FakeWorkspaceNotifier`.
class _FakeWorkspaceNotifier extends WorkspaceNotifier {
  _FakeWorkspaceNotifier(super.bridge) {
    addWorkspace(id: "ws1", name: "Test Workspace");
  }

  @override
  Future<void> fetchHierarchy(String workspaceId) async {}
}

ProviderContainer _buildContainer() {
  final bridge = _FakeBridge();
  return ProviderContainer(
    overrides: [
      sidecarBridgeProvider.overrideWithValue(bridge),
      workspaceProvider.overrideWith((ref) => _FakeWorkspaceNotifier(bridge)),
    ],
  );
}

void main() {
  // The full shell (240px Sidebar + main content + 384px DiagnosticSidebar,
  // the latter still reserving layout width even while slid off-screen)
  // plus DashboardPage/InvestigationPage's own content is wider/taller than
  // the default 800x600 test surface, matching `dashboard_page_test.dart`'s
  // setup.
  setUp(() {
    final binding = TestWidgetsFlutterBinding.ensureInitialized();
    binding.platformDispatcher.views.first.physicalSize = const Size(1600, 2200);
    binding.platformDispatcher.views.first.devicePixelRatio = 1.0;
  });
  tearDown(() {
    final binding = TestWidgetsFlutterBinding.ensureInitialized();
    binding.platformDispatcher.views.first.resetPhysicalSize();
    binding.platformDispatcher.views.first.resetDevicePixelRatio();
  });

  testWidgets("App shell renders the real Sidebar and Dashboard page by default", (
    WidgetTester tester,
  ) async {
    final container = _buildContainer();
    addTearDown(container.dispose);

    await tester.pumpWidget(UncontrolledProviderScope(container: container, child: const LogLensApp()));
    await _settle(tester);

    expect(find.byType(Sidebar), findsOneWidget);
    // Sidebar's footer nav (Dashboard/Settings) and the workspace row both
    // render regardless of active tab.
    expect(find.text("Dashboard"), findsWidgets);
    expect(find.text("Settings"), findsWidgets);
    // DashboardPage's own workspace filter also renders the workspace's
    // name (as the selected dropdown value), so scope this finder to the
    // Sidebar's workspace row specifically rather than asserting a single
    // match across the whole tree.
    expect(_workspaceRowFinder, findsOneWidget);
    // The placeholder shell's text no longer exists anywhere in the tree.
    expect(find.textContaining("coming in a later Phase 5 pass"), findsNothing);
  });

  testWidgets("Selecting a workspace in the Sidebar swaps the main content to the real InvestigationPage", (
    WidgetTester tester,
  ) async {
    final container = _buildContainer();
    addTearDown(container.dispose);

    await tester.pumpWidget(UncontrolledProviderScope(container: container, child: const LogLensApp()));
    await _settle(tester);

    await tester.tap(_workspaceRowFinder);
    await _settle(tester);

    // LogToolbar (InvestigationPage's top chrome) is now mounted.
    expect(find.byType(LogToolbar), findsOneWidget);
  });
}

/// The Sidebar's workspace row for "Test Workspace" -- scoped under
/// [Sidebar] specifically since `DashboardPage`'s own workspace filter also
/// renders the workspace's name as its selected dropdown value.
Finder get _workspaceRowFinder =>
    find.descendant(of: find.byType(Sidebar), matching: find.text("Test Workspace"));

/// Flushes the mount-time async RPC chains (`DashboardNotifier.fetchStats`,
/// `InvestigationPage`'s log fetch, ...) without `pumpAndSettle` --
/// `LogToolbar` (mounted once Investigation is selected) always renders a
/// [StatusDot] whose `active: true` default drives an infinitely-repeating
/// ping animation, which `pumpAndSettle` never considers settled. Matches
/// `log_toolbar_test.dart`/`import_feed_modal_test.dart`'s established
/// `tester.pump()`-only convention for pages/organisms that mount an
/// active [StatusDot].
Future<void> _settle(WidgetTester tester) async {
  await tester.pump();
  await tester.pump(const Duration(milliseconds: 50));
  await tester.pump();
}
