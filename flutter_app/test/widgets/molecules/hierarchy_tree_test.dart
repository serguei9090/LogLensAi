import "package:flutter/material.dart";
import "package:flutter_test/flutter_test.dart";

import "package:loglensai/models/workspace.dart";
import "package:loglensai/widgets/molecules/hierarchy_tree.dart";

Widget _wrap(Widget child) => MaterialApp(home: Scaffold(body: child));

const _tree = HierarchyNode(
  id: "root",
  name: "root",
  children: [
    HierarchyNode(
      id: "folder-1",
      name: "Production",
      sources: [LogSource(id: "src-1", name: "app.log", type: "local", path: "/var/log/app.log")],
    ),
  ],
  sources: [LogSource(id: "src-root", name: "root-source.log", type: "local", path: "/root.log")],
);

void main() {
  testWidgets("renders folders and sources without throwing", (tester) async {
    await tester.pumpWidget(
      _wrap(
        HierarchyTree(
          node: _tree,
          onSelectSource: (_) {},
          onSelectFolder: (_) {},
        ),
      ),
    );

    expect(find.text("Production"), findsOneWidget);
    expect(find.text("root-source.log"), findsOneWidget);
    // Folder starts expanded (initiallyExpanded defaults true), so its
    // nested source is visible immediately.
    expect(find.text("app.log"), findsOneWidget);
  });

  testWidgets("collapsing a folder hides its nested source, expanding shows it again", (tester) async {
    await tester.pumpWidget(
      _wrap(
        HierarchyTree(
          node: _tree,
          onSelectSource: (_) {},
          onSelectFolder: (_) {},
        ),
      ),
    );

    expect(find.text("app.log"), findsOneWidget);

    await tester.tap(find.byIcon(Icons.expand_more));
    await tester.pump();

    expect(find.text("app.log"), findsNothing);

    await tester.tap(find.byIcon(Icons.chevron_right));
    await tester.pump();

    expect(find.text("app.log"), findsOneWidget);
  });

  testWidgets("tapping a source row reports it via onSelectSource", (tester) async {
    LogSource? selected;
    await tester.pumpWidget(
      _wrap(
        HierarchyTree(
          node: _tree,
          onSelectSource: (s) => selected = s,
          onSelectFolder: (_) {},
        ),
      ),
    );

    await tester.tap(find.text("root-source.log"));
    await tester.pump();

    expect(selected?.id, "src-root");
  });

  testWidgets("tapping a folder row reports it via onSelectFolder", (tester) async {
    HierarchyNode? selected;
    await tester.pumpWidget(
      _wrap(
        HierarchyTree(
          node: _tree,
          onSelectSource: (_) {},
          onSelectFolder: (f) => selected = f,
        ),
      ),
    );

    await tester.tap(find.text("Production"));
    await tester.pump();

    expect(selected?.id, "folder-1");
  });

  testWidgets("New Folder affordance opens an inline text field and submits on Enter", (tester) async {
    String? parentId;
    String? createdName;
    await tester.pumpWidget(
      _wrap(
        HierarchyTree(
          node: _tree,
          onSelectSource: (_) {},
          onSelectFolder: (_) {},
          onCreateFolder: (parent, name) {
            parentId = parent;
            createdName = name;
          },
        ),
      ),
    );

    await tester.tap(find.text("New Folder"));
    await tester.pump();

    await tester.enterText(find.widgetWithText(TextField, "Folder name"), "Staging");
    await tester.testTextInput.receiveAction(TextInputAction.done);
    await tester.pump();

    expect(parentId, "root");
    expect(createdName, "Staging");
  });

  testWidgets("delete button on a source opens a destructive confirmation dialog", (tester) async {
    // A folder-free tree so the only delete icon present is the source's
    // own (the folder header would render an earlier delete icon first).
    const sourceOnlyTree = HierarchyNode(
      id: "root",
      name: "root",
      sources: [LogSource(id: "src-root", name: "root-source.log", type: "local", path: "/root.log")],
    );
    var deletedId = "";
    await tester.pumpWidget(
      _wrap(
        HierarchyTree(
          node: sourceOnlyTree,
          onSelectSource: (_) {},
          onSelectFolder: (_) {},
          onDeleteSource: (id) => deletedId = id,
        ),
      ),
    );

    await tester.tap(find.byIcon(Icons.delete_outline).first);
    await tester.pumpAndSettle();

    expect(find.text("Delete Source?"), findsOneWidget);

    await tester.tap(find.text("Delete"));
    await tester.pumpAndSettle();

    expect(deletedId, isNotEmpty);
  });
}
