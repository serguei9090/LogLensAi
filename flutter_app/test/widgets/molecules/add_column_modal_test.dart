import "package:flutter/material.dart";
import "package:flutter_test/flutter_test.dart";

import "package:loglensai/models/ui_column.dart";
import "package:loglensai/widgets/molecules/add_column_modal.dart";

Widget _wrap(Widget child) => MaterialApp(home: Scaffold(body: child));

void main() {
  testWidgets("renders without throwing and Add Column starts disabled", (tester) async {
    await tester.pumpWidget(
      _wrap(
        AddColumnModal(
          sampleLogs: const ["2024-01-01 ERROR something broke", "2024-01-01 INFO ok"],
          onSave: (_) {},
        ),
      ),
    );

    expect(find.text("Add Custom Column"), findsOneWidget);
    final addButton = tester.widget<ElevatedButton>(find.byType(ElevatedButton));
    expect(addButton.onPressed, isNull);
  });

  testWidgets("filling name + valid regex enables Add Column and previews matches", (tester) async {
    await tester.pumpWidget(
      _wrap(
        AddColumnModal(
          sampleLogs: const ["user_id=42 status=200", "user_id=7 status=500"],
          onSave: (_) {},
        ),
      ),
    );

    await tester.enterText(find.widgetWithText(TextField, "e.g. User Agent"), "User Id");
    await tester.enterText(find.byType(TextField).at(1), r"user_id=(\d+)");
    await tester.pump();

    expect(find.text("→ 42"), findsOneWidget);
    expect(find.text("→ 7"), findsOneWidget);
    expect(find.text("2/2 matches"), findsOneWidget);

    final addButton = tester.widget<ElevatedButton>(find.byType(ElevatedButton));
    expect(addButton.onPressed, isNotNull);
  });

  testWidgets("saving emits a CustomColumnDef with source=user", (tester) async {
    CustomColumnDef? saved;
    await tester.pumpWidget(
      _wrap(
        AddColumnModal(
          sampleLogs: const ["status=200"],
          onSave: (col) => saved = col,
        ),
      ),
    );

    await tester.enterText(find.widgetWithText(TextField, "e.g. User Agent"), "Status");
    await tester.enterText(find.byType(TextField).at(1), r"status=(\d+)");
    await tester.pump();

    await tester.tap(find.text("Add Column"));
    await tester.pump();

    expect(saved, isNotNull);
    expect(saved!.label, "Status");
    expect(saved!.source, "user");
    expect(saved!.regex, r"status=(\d+)");
  });

  testWidgets("invalid regex shows an error and keeps Add Column disabled", (tester) async {
    await tester.pumpWidget(
      _wrap(AddColumnModal(sampleLogs: const ["a line"], onSave: (_) {})),
    );

    await tester.enterText(find.widgetWithText(TextField, "e.g. User Agent"), "Broken");
    await tester.enterText(find.byType(TextField).at(1), "(unterminated");
    await tester.pump();

    final addButton = tester.widget<ElevatedButton>(find.byType(ElevatedButton));
    expect(addButton.onPressed, isNull);
  });
}
