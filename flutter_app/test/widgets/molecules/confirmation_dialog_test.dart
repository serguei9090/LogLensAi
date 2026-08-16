import "package:flutter/material.dart";
import "package:flutter_test/flutter_test.dart";

import "package:loglensai/widgets/molecules/confirmation_dialog.dart";

Widget _wrap(Widget child) => MaterialApp(home: Scaffold(body: child));

void main() {
  testWidgets("renders title, description, and confirm text without throwing", (tester) async {
    await tester.pumpWidget(
      _wrap(
        ConfirmationDialog(
          title: "Delete Workspace?",
          description: "This cannot be undone.",
          confirmText: "Delete",
          onConfirm: () {},
        ),
      ),
    );

    expect(find.text("Delete Workspace?"), findsOneWidget);
    expect(find.text("This cannot be undone."), findsOneWidget);
    expect(find.text("Delete"), findsOneWidget);
    expect(find.text("Cancel"), findsOneWidget);
  });

  testWidgets("tapping confirm fires onConfirm exactly once", (tester) async {
    var confirmCount = 0;
    await tester.pumpWidget(
      _wrap(
        ConfirmationDialog(
          title: "Delete Source?",
          description: "Removes it from the workspace.",
          onConfirm: () => confirmCount++,
        ),
      ),
    );

    await tester.tap(find.text("Confirm"));
    await tester.pump();

    expect(confirmCount, 1);
  });

  testWidgets("tapping cancel fires onCancel and not onConfirm", (tester) async {
    var confirmCount = 0;
    var cancelCount = 0;
    await tester.pumpWidget(
      _wrap(
        ConfirmationDialog(
          title: "Delete Folder?",
          description: "Removes all subfolders.",
          onConfirm: () => confirmCount++,
          onCancel: () => cancelCount++,
        ),
      ),
    );

    await tester.tap(find.text("Cancel"));
    await tester.pump();

    expect(cancelCount, 1);
    expect(confirmCount, 0);
  });

  testWidgets("show() pushes a dialog route and pops it on confirm", (tester) async {
    var confirmCount = 0;
    await tester.pumpWidget(
      _wrap(
        Builder(
          builder: (context) => ElevatedButton(
            onPressed: () => ConfirmationDialog.show(
              context,
              title: "Delete?",
              description: "Sure?",
              onConfirm: () => confirmCount++,
            ),
            child: const Text("Open"),
          ),
        ),
      ),
    );

    await tester.tap(find.text("Open"));
    await tester.pumpAndSettle();
    expect(find.text("Delete?"), findsOneWidget);

    await tester.tap(find.text("Confirm"));
    await tester.pumpAndSettle();

    expect(confirmCount, 1);
    expect(find.text("Delete?"), findsNothing);
  });
}
