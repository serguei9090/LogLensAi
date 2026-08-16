import "package:flutter/material.dart";
import "package:flutter_riverpod/flutter_riverpod.dart";
import "package:flutter_test/flutter_test.dart";

import "package:loglensai/app.dart";
import "package:loglensai/providers/ui_provider.dart";
import "package:loglensai/providers/workspace_provider.dart";
import "package:loglensai/services/sidecar_bridge.dart";
import "package:loglensai/theme/app_theme.dart";
import "package:loglensai/widgets/organisms/sidebar.dart";

/// Fake [WorkspaceNotifier] that never touches a real [SidecarBridge] for
/// `fetchHierarchy` (unlike `addWorkspace`/`setActive`, it isn't pure-local
/// -- it awaits `get_hierarchy` with no error handling of its own), mirroring
/// `ai_investigation_sidebar_test.dart`'s `_FakeAiNotifier` pattern.
class _FakeWorkspaceNotifier extends WorkspaceNotifier {
  _FakeWorkspaceNotifier() : super(SidecarBridge());

  final List<String> fetchHierarchyCalls = [];

  @override
  Future<void> fetchHierarchy(String workspaceId) async {
    fetchHierarchyCalls.add(workspaceId);
  }
}

ProviderContainer _buildContainer({List<(String, String)> workspaces = const [("ws1", "Primary")]}) {
  final notifier = _FakeWorkspaceNotifier();
  for (final (id, name) in workspaces) {
    notifier.addWorkspace(id: id, name: name);
  }
  return ProviderContainer(
    overrides: [workspaceProvider.overrideWith((ref) => notifier)],
  );
}

Widget _wrap(ProviderContainer container, Widget child) {
  return UncontrolledProviderScope(
    container: container,
    child: MaterialApp(theme: AppTheme.dark, home: Scaffold(body: SizedBox(height: 700, child: child))),
  );
}

void main() {
  testWidgets("renders expanded at 240px with workspace name and nav footer", (tester) async {
    final container = _buildContainer();
    addTearDown(container.dispose);

    await tester.pumpWidget(
      _wrap(container, Sidebar(activeNav: NavTab.investigation, onNavSelect: (_) {})),
    );

    expect(find.text("Primary"), findsOneWidget);
    expect(find.text("Dashboard"), findsOneWidget);
    expect(find.text("Settings"), findsOneWidget);
    expect(find.text("Collapse Sidebar"), findsOneWidget);

    final animatedContainer = tester.widget<AnimatedContainer>(find.byType(AnimatedContainer));
    expect(animatedContainer.constraints?.maxWidth, 240);
  });

  testWidgets("tapping the collapse toggle flips uiProvider.sidebarCollapsed", (tester) async {
    final container = _buildContainer();
    addTearDown(container.dispose);

    await tester.pumpWidget(
      _wrap(container, Sidebar(activeNav: NavTab.investigation, onNavSelect: (_) {})),
    );

    expect(container.read(uiProvider).sidebarCollapsed, isFalse);

    // A single bare `pump()` (rather than `pumpAndSettle`, which steps
    // through every frame of the 220ms width transition) is enough to
    // process the tap's state change -- `collapsed` is read directly off
    // the provider below, not off any mid-animation render, so there's no
    // need to wait out the `AnimatedContainer`'s width animation at all.
    await tester.tap(find.text("Collapse Sidebar"));
    await tester.pump();

    expect(container.read(uiProvider).sidebarCollapsed, isTrue);

    container.read(uiProvider.notifier).toggleSidebar();
    expect(container.read(uiProvider).sidebarCollapsed, isFalse);
  });

  testWidgets("collapsed rendering hides workspace/nav labels behind icon-only rows", (tester) async {
    final container = ProviderContainer(
      overrides: [
        workspaceProvider.overrideWith(
          (ref) => _FakeWorkspaceNotifier()..addWorkspace(id: "ws1", name: "Primary"),
        ),
        uiProvider.overrideWith((ref) => UiNotifier()..setSidebarCollapsed(true)),
      ],
    );
    addTearDown(container.dispose);

    // Mounted directly in the collapsed state (rather than reached via a
    // tap) so `AnimatedContainer` never has to animate at all -- its very
    // first build already targets the settled 60px width, sidestepping the
    // transient render-vs-width mismatch a live collapse/expand transition
    // would otherwise produce mid-animation.
    await tester.pumpWidget(
      _wrap(container, Sidebar(activeNav: NavTab.investigation, onNavSelect: (_) {})),
    );

    expect(find.text("Primary"), findsNothing);
    expect(find.text("Dashboard"), findsNothing);
    expect(find.text("Settings"), findsNothing);

    final animatedContainer = tester.widget<AnimatedContainer>(find.byType(AnimatedContainer));
    expect(animatedContainer.constraints?.maxWidth, 60);
  });

  testWidgets("tapping a workspace selects it, switches to Investigation nav, and fetches its hierarchy", (
    tester,
  ) async {
    final container = _buildContainer(
      workspaces: const [("ws1", "Primary"), ("ws2", "Secondary")],
    );
    addTearDown(container.dispose);
    NavTab? selected;

    // Make ws2 the active nav target by starting on the Dashboard tab so the
    // tap's `onNavSelect(NavTab.investigation)` is observable.
    await tester.pumpWidget(
      _wrap(
        container,
        Sidebar(activeNav: NavTab.dashboard, onNavSelect: (tab) => selected = tab),
      ),
    );

    await tester.tap(find.text("Secondary"));
    await tester.pumpAndSettle();

    expect(container.read(workspaceProvider).activeWorkspaceId, "ws2");
    expect(selected, NavTab.investigation);
    final fake = container.read(workspaceProvider.notifier) as _FakeWorkspaceNotifier;
    expect(fake.fetchHierarchyCalls, contains("ws2"));
  });

  testWidgets("the footer Dashboard/Settings items forward onNavSelect", (tester) async {
    final container = _buildContainer();
    addTearDown(container.dispose);
    final selections = <NavTab>[];

    await tester.pumpWidget(
      _wrap(
        container,
        Sidebar(activeNav: NavTab.investigation, onNavSelect: selections.add),
      ),
    );

    await tester.tap(find.text("Dashboard"));
    await tester.tap(find.text("Settings"));
    await tester.pump();

    expect(selections, [NavTab.dashboard, NavTab.settings]);
  });
}
