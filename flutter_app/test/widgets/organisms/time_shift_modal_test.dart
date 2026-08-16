import "package:flutter/material.dart";
import "package:flutter_test/flutter_test.dart";

import "package:loglensai/theme/app_theme.dart";
import "package:loglensai/widgets/organisms/time_shift_modal.dart";

/// Launches [TimeShiftModal] via its real `.show()` entry point (the way
/// every real call site uses it) behind a button, so `Navigator.of(context)`
/// inside the modal always has a pushed route to pop.
Widget _harness({
  required int initialShiftSeconds,
  required ValueChanged<int> onSaved,
  String sourceLabel = "app.log",
}) {
  return MaterialApp(
    theme: AppTheme.dark,
    home: Builder(
      builder: (context) => Scaffold(
        body: Center(
          child: ElevatedButton(
            onPressed: () => TimeShiftModal.show(
              context,
              sourceLabel: sourceLabel,
              initialShiftSeconds: initialShiftSeconds,
              onSaved: onSaved,
            ),
            child: const Text("Open"),
          ),
        ),
      ),
    ),
  );
}

void main() {
  testWidgets("shows the source label and defaults to a zero shift in relative mode", (tester) async {
    await tester.pumpWidget(_harness(initialShiftSeconds: 0, onSaved: (_) {}, sourceLabel: "web-1.log"));

    await tester.tap(find.text("Open"));
    await tester.pumpAndSettle();

    expect(find.text("Time Alignment"), findsOneWidget);
    expect(find.text("web-1.log"), findsOneWidget);
    expect(find.text("0s"), findsOneWidget);
  });

  testWidgets("Apply in relative mode reports the computed signed offset and closes", (tester) async {
    int? saved;
    await tester.pumpWidget(_harness(initialShiftSeconds: 0, onSaved: (v) => saved = v));

    await tester.tap(find.text("Open"));
    await tester.pumpAndSettle();

    // Days field is the first of the four unit TextFormFields.
    await tester.enterText(find.byType(TextFormField).at(0), "2");
    await tester.pump();
    expect(find.text("+172800s"), findsOneWidget);

    await tester.tap(find.text("Subtract"));
    await tester.pump();
    expect(find.text("-172800s"), findsOneWidget);

    await tester.tap(find.text("Apply"));
    await tester.pumpAndSettle();

    expect(saved, -172800);
    expect(find.text("Time Alignment"), findsNothing);
  });

  testWidgets("pre-fills the unit fields from a negative initial offset", (tester) async {
    // -90061s = -(1d 1h 1m 1s).
    await tester.pumpWidget(_harness(initialShiftSeconds: -90061, onSaved: (_) {}));

    await tester.tap(find.text("Open"));
    await tester.pumpAndSettle();

    expect(find.text("-90061s"), findsOneWidget);

    final fields = tester.widgetList<TextFormField>(find.byType(TextFormField)).toList();
    expect(fields.map((f) => f.initialValue).toList(), ["1", "1", "1", "1"]);
  });

  testWidgets("Cancel closes without reporting a value", (tester) async {
    var savedCalled = false;
    await tester.pumpWidget(_harness(initialShiftSeconds: 0, onSaved: (_) => savedCalled = true));

    await tester.tap(find.text("Open"));
    await tester.pumpAndSettle();

    await tester.tap(find.text("Cancel"));
    await tester.pumpAndSettle();

    expect(savedCalled, isFalse);
    expect(find.text("Time Alignment"), findsNothing);
  });

  testWidgets("Visual Sync mode computes the offset from two pasted timestamps", (tester) async {
    int? saved;
    await tester.pumpWidget(_harness(initialShiftSeconds: 0, onSaved: (v) => saved = v));

    await tester.tap(find.text("Open"));
    await tester.pumpAndSettle();

    await tester.tap(find.text("Visual Sync"));
    await tester.pumpAndSettle();

    final tsFields = find.byType(TextField);
    await tester.enterText(tsFields.at(0), "2024-05-25 00:00:00");
    await tester.enterText(tsFields.at(1), "2024-05-25 02:00:00");

    await tester.tap(find.text("Apply"));
    await tester.pumpAndSettle();

    expect(saved, 7200);
  });

  testWidgets("Visual Sync mode surfaces an error and does not close on invalid timestamps", (tester) async {
    var savedCalled = false;
    await tester.pumpWidget(_harness(initialShiftSeconds: 0, onSaved: (_) => savedCalled = true));

    await tester.tap(find.text("Open"));
    await tester.pumpAndSettle();

    await tester.tap(find.text("Visual Sync"));
    await tester.pumpAndSettle();

    final tsFields = find.byType(TextField);
    await tester.enterText(tsFields.at(0), "not-a-date");
    await tester.enterText(tsFields.at(1), "also-not-a-date");

    await tester.tap(find.text("Apply"));
    await tester.pump();

    expect(savedCalled, isFalse);
    expect(find.textContaining("Invalid timestamp format"), findsOneWidget);
    expect(find.text("Time Alignment"), findsOneWidget);
  });
}
