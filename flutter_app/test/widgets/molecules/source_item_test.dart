import "package:flutter/material.dart";
import "package:flutter_test/flutter_test.dart";
import "package:loglensai/models/workspace.dart";
import "package:loglensai/theme/app_theme.dart";
import "package:loglensai/widgets/atoms/ingestion_progress_badge.dart";
import "package:loglensai/widgets/molecules/source_item.dart";

const _source = LogSource(id: "s1", name: "apache_logs.log", type: "local", path: "/var/log/apache_logs.log");

Widget _host(Widget child) => MaterialApp(theme: AppTheme.dark, home: Scaffold(body: child));

void main() {
  testWidgets("renders the source name", (tester) async {
    await tester.pumpWidget(
      _host(
        SourceItem(
          source: _source,
          active: false,
          onTap: () {},
          onDelete: () {},
          onRename: (_) {},
        ),
      ),
    );

    expect(find.text("apache_logs.log"), findsOneWidget);
  });

  testWidgets("tapping the row fires onTap", (tester) async {
    var tapped = false;
    await tester.pumpWidget(
      _host(
        SourceItem(
          source: _source,
          active: false,
          onTap: () => tapped = true,
          onDelete: () {},
          onRename: (_) {},
        ),
      ),
    );

    await tester.tap(find.text("apache_logs.log"));
    await tester.pump();

    expect(tapped, isTrue);
  });

  testWidgets("tapping the delete icon fires onDelete", (tester) async {
    var deleted = false;
    await tester.pumpWidget(
      _host(
        SourceItem(
          source: _source,
          active: false,
          onTap: () {},
          onDelete: () => deleted = true,
          onRename: (_) {},
        ),
      ),
    );

    await tester.tap(find.byIcon(Icons.delete_outline));
    await tester.pump();

    expect(deleted, isTrue);
  });

  testWidgets("shows an ingestion badge when a status is supplied", (tester) async {
    await tester.pumpWidget(
      _host(
        SourceItem(
          source: _source,
          active: false,
          onTap: () {},
          onDelete: () {},
          onRename: (_) {},
          badgeStatus: IngestionStatus.processing,
          progress: 0.5,
        ),
      ),
    );

    expect(find.byType(IngestionProgressBadge), findsOneWidget);
    expect(find.text("50%"), findsOneWidget);
  });

  testWidgets("renders nothing badge-wise when status is null", (tester) async {
    await tester.pumpWidget(
      _host(
        SourceItem(
          source: _source,
          active: false,
          onTap: () {},
          onDelete: () {},
          onRename: (_) {},
        ),
      ),
    );

    expect(find.byType(IngestionProgressBadge), findsNothing);
  });

  testWidgets("full rename flow: edit icon enters rename mode, Enter commits new name", (
    tester,
  ) async {
    var renaming = false;
    String? renamedTo;

    await tester.pumpWidget(
      _host(
        StatefulBuilder(
          builder: (context, setState) {
            return SourceItem(
              source: _source,
              active: false,
              onTap: () {},
              onDelete: () {},
              onRename: (name) {
                renamedTo = name;
                setState(() => renaming = false);
              },
              isRenaming: renaming,
              onRenamingChanged: (v) => setState(() => renaming = v),
            );
          },
        ),
      ),
    );

    await tester.tap(find.byIcon(Icons.edit_outlined));
    await tester.pump();

    expect(find.byType(TextField), findsOneWidget);

    await tester.enterText(find.byType(TextField), "renamed.log");
    await tester.testTextInput.receiveAction(TextInputAction.done);
    await tester.pump();

    expect(renamedTo, "renamed.log");
    expect(renaming, isFalse);
  });
}
