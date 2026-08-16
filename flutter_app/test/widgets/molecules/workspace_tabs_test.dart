import "package:flutter/material.dart";
import "package:flutter_test/flutter_test.dart";
import "package:loglensai/models/workspace.dart";
import "package:loglensai/theme/app_theme.dart";
import "package:loglensai/widgets/molecules/workspace_tabs.dart";

const _sources = [
  LogSource(id: "a", name: "app.log", type: "local", path: "/var/log/app.log"),
  LogSource(id: "b", name: "fusion-view", type: "fusion", path: "fusion-1"),
];

Widget _host(Widget child) => MaterialApp(theme: AppTheme.dark, home: Scaffold(body: child));

void main() {
  testWidgets("renders nothing when there are no sources", (tester) async {
    await tester.pumpWidget(
      _host(
        WorkspaceTabs(
          sources: const [],
          activeSourceId: null,
          onSelectSource: (_) {},
          activeWorkspaceId: "ws1",
        ),
      ),
    );

    expect(find.byType(WorkspaceTabs), findsOneWidget);
    expect(find.byType(ListView), findsNothing);
  });

  testWidgets("renders a tab per source", (tester) async {
    await tester.pumpWidget(
      _host(
        WorkspaceTabs(
          sources: _sources,
          activeSourceId: "a",
          onSelectSource: (_) {},
          activeWorkspaceId: "ws1",
        ),
      ),
    );

    expect(find.text("app.log"), findsOneWidget);
    expect(find.text("fusion-view"), findsOneWidget);
  });

  testWidgets("tapping a tab fires onSelectSource with its id", (tester) async {
    String? selected;
    await tester.pumpWidget(
      _host(
        WorkspaceTabs(
          sources: _sources,
          activeSourceId: "a",
          onSelectSource: (id) => selected = id,
          activeWorkspaceId: "ws1",
        ),
      ),
    );

    await tester.tap(find.text("fusion-view"));
    await tester.pump();

    expect(selected, "b");
  });

  testWidgets("close (X) button fires onRemoveSource with the tab's id", (tester) async {
    String? removed;
    await tester.pumpWidget(
      _host(
        WorkspaceTabs(
          sources: _sources,
          activeSourceId: "a",
          onSelectSource: (_) {},
          onRemoveSource: (id) => removed = id,
          activeWorkspaceId: "ws1",
        ),
      ),
    );

    final closeButtons = find.byIcon(Icons.close);
    expect(closeButtons, findsNWidgets(2));

    await tester.tap(closeButtons.first);
    await tester.pump();

    expect(removed, "a");
  });

  testWidgets("close button is absent when onRemoveSource is not supplied", (tester) async {
    await tester.pumpWidget(
      _host(
        WorkspaceTabs(
          sources: _sources,
          activeSourceId: "a",
          onSelectSource: (_) {},
          activeWorkspaceId: "ws1",
        ),
      ),
    );

    expect(find.byIcon(Icons.close), findsNothing);
  });
}
