import "package:flutter/material.dart";
import "package:flutter_test/flutter_test.dart";

import "package:loglensai/models/workspace.dart";
import "package:loglensai/theme/app_theme.dart";
import "package:loglensai/widgets/organisms/explorer_view.dart";

Widget _wrap(Widget child, {Size size = const Size(1400, 900)}) {
  return MediaQuery(
    data: MediaQueryData(size: size),
    child: MaterialApp(
      theme: AppTheme.dark,
      home: Scaffold(body: SizedBox(width: size.width, height: size.height, child: child)),
    ),
  );
}

const _source1 = LogSource(id: "src1", name: "app.log", type: "local", path: "/var/log/app.log");
const _source2 = LogSource(id: "src2", name: "nginx.log", type: "ssh", path: "user@host:/nginx.log");

const _subFolder = HierarchyNode(id: "f2", name: "Subfolder", sources: [_source2]);

const _root = HierarchyNode(
  id: "root",
  name: "Workspace",
  children: [_subFolder],
  sources: [_source1],
);

void main() {
  testWidgets("shows 'Folder not found' when hierarchy is null", (tester) async {
    await tester.pumpWidget(
      _wrap(
        ExplorerView(
          folderId: null,
          hierarchy: null,
          onSelectFolder: (_) {},
          onSelectSource: (_) {},
        ),
      ),
    );

    expect(find.text("Folder not found"), findsOneWidget);
  });

  testWidgets("renders folder + source cards for the root, with counts", (tester) async {
    await tester.pumpWidget(
      _wrap(
        ExplorerView(
          folderId: null,
          hierarchy: _root,
          workspaceName: "My Workspace",
          onSelectFolder: (_) {},
          onSelectSource: (_) {},
        ),
      ),
    );
    await tester.pump();

    expect(find.text("My Workspace"), findsOneWidget);
    expect(find.text("1 folders, 1 sources"), findsOneWidget);
    expect(find.text("Subfolder"), findsOneWidget);
    expect(find.text("app.log"), findsOneWidget);
    expect(find.text("local Source"), findsOneWidget);
  });

  testWidgets("tapping a folder card calls onSelectFolder", (tester) async {
    String? selected;
    await tester.pumpWidget(
      _wrap(
        ExplorerView(
          folderId: null,
          hierarchy: _root,
          onSelectFolder: (id) => selected = id,
          onSelectSource: (_) {},
        ),
      ),
    );
    await tester.pump();

    await tester.tap(find.text("Subfolder"));
    await tester.pump();

    expect(selected, "f2");
  });

  testWidgets("tapping a source card calls onSelectSource", (tester) async {
    String? selected;
    await tester.pumpWidget(
      _wrap(
        ExplorerView(
          folderId: null,
          hierarchy: _root,
          onSelectFolder: (_) {},
          onSelectSource: (id) => selected = id,
        ),
      ),
    );
    await tester.pump();

    await tester.tap(find.text("app.log"));
    await tester.pump();

    expect(selected, "src1");
  });

  testWidgets("navigating into a folder shows its own children/sources", (tester) async {
    await tester.pumpWidget(
      _wrap(
        ExplorerView(
          folderId: "f2",
          hierarchy: _root,
          onSelectFolder: (_) {},
          onSelectSource: (_) {},
        ),
      ),
    );
    await tester.pump();

    expect(find.text("Subfolder"), findsOneWidget); // title now, not a card
    expect(find.text("nginx.log"), findsOneWidget);
    expect(find.text("app.log"), findsNothing);
  });

  testWidgets("empty folder shows the empty state", (tester) async {
    const emptyRoot = HierarchyNode(id: "root", name: "Workspace");
    await tester.pumpWidget(
      _wrap(
        ExplorerView(
          folderId: null,
          hierarchy: emptyRoot,
          onSelectFolder: (_) {},
          onSelectSource: (_) {},
        ),
      ),
    );
    await tester.pump();

    expect(find.text("This folder is empty"), findsOneWidget);
  });

  testWidgets("New Folder button calls onCreateFolder", (tester) async {
    String? created;
    await tester.pumpWidget(
      _wrap(
        ExplorerView(
          folderId: null,
          hierarchy: _root,
          onSelectFolder: (_) {},
          onSelectSource: (_) {},
          onCreateFolder: (name) => created = name,
        ),
      ),
    );
    await tester.pump();

    await tester.tap(find.text("New Folder"));
    await tester.pump();

    expect(created, "New Folder");
  });

  testWidgets("Import Log button calls onImportOpen", (tester) async {
    var called = false;
    await tester.pumpWidget(
      _wrap(
        ExplorerView(
          folderId: null,
          hierarchy: _root,
          onSelectFolder: (_) {},
          onSelectSource: (_) {},
          onImportOpen: () => called = true,
        ),
      ),
    );
    await tester.pump();

    await tester.tap(find.text("Import Log"));
    await tester.pump();

    expect(called, isTrue);
  });

  testWidgets("rename flow: overflow menu -> Rename -> submit updates via onRenameSource", (
    tester,
  ) async {
    String? renamedId;
    String? renamedTo;
    await tester.pumpWidget(
      _wrap(
        ExplorerView(
          folderId: null,
          hierarchy: _root,
          onSelectFolder: (_) {},
          onSelectSource: (_) {},
          onRenameSource: (id, name) {
            renamedId = id;
            renamedTo = name;
          },
        ),
      ),
    );
    await tester.pump();

    await tester.tap(find.byIcon(Icons.more_vert));
    await tester.pumpAndSettle();
    await tester.tap(find.text("Rename"));
    await tester.pump();

    expect(find.byType(TextField), findsOneWidget);
    await tester.enterText(find.byType(TextField), "renamed.log");
    await tester.testTextInput.receiveAction(TextInputAction.done);
    await tester.pump();

    expect(renamedId, "src1");
    expect(renamedTo, "renamed.log");
  });

  testWidgets("delete flow: overflow menu -> Delete -> confirm calls onDeleteSource", (
    tester,
  ) async {
    String? deletedId;
    await tester.pumpWidget(
      _wrap(
        ExplorerView(
          folderId: null,
          hierarchy: _root,
          onSelectFolder: (_) {},
          onSelectSource: (_) {},
          onDeleteSource: (id) => deletedId = id,
        ),
      ),
    );
    await tester.pump();

    await tester.tap(find.byIcon(Icons.more_vert));
    await tester.pumpAndSettle();
    await tester.tap(find.text("Delete"));
    await tester.pumpAndSettle();

    expect(find.text("Delete Source?"), findsOneWidget);
    await tester.tap(find.text("Delete").last);
    await tester.pumpAndSettle();

    expect(deletedId, "src1");
  });

  testWidgets("no overflow menu when neither rename nor delete callbacks are supplied", (
    tester,
  ) async {
    await tester.pumpWidget(
      _wrap(
        ExplorerView(
          folderId: null,
          hierarchy: _root,
          onSelectFolder: (_) {},
          onSelectSource: (_) {},
        ),
      ),
    );
    await tester.pump();

    expect(find.byIcon(Icons.more_vert), findsNothing);
  });
}
