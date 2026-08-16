import "package:flutter/material.dart";
import "package:flutter_test/flutter_test.dart";

import "package:loglensai/models/log_entry.dart";
import "package:loglensai/widgets/molecules/filter_builder.dart";

Widget _wrap(Widget child) => MaterialApp(home: Scaffold(body: child));

void main() {
  testWidgets("renders the trigger chip without throwing, panel starts closed", (tester) async {
    await tester.pumpWidget(_wrap(FilterBuilder(filters: const [], onChange: (_) {})));

    expect(find.text("Filters"), findsOneWidget);
    expect(find.text("Add Filter"), findsNothing);
  });

  testWidgets("tapping the trigger opens the field/operator/value panel", (tester) async {
    await tester.pumpWidget(_wrap(FilterBuilder(filters: const [], onChange: (_) {})));

    await tester.tap(find.text("Filters"));
    await tester.pump();

    expect(find.text("Add Filter"), findsOneWidget);
    expect(find.text("Message"), findsOneWidget);
    expect(find.text("contains"), findsWidgets);
  });

  testWidgets("adding a filter appends field/operator/value and clears the input", (tester) async {
    List<LogFilter>? reported;
    await tester.pumpWidget(
      _wrap(FilterBuilder(filters: const [], onChange: (f) => reported = f)),
    );

    await tester.tap(find.text("Filters"));
    await tester.pump();

    await tester.tap(find.text("Level"));
    await tester.pump();
    await tester.tap(find.text("is exactly"));
    await tester.pump();

    await tester.enterText(find.widgetWithText(TextField, "Value..."), "ERROR");
    await tester.tap(find.byIcon(Icons.add));
    await tester.pump();

    expect(reported, isNotNull);
    expect(reported!.length, 1);
    expect(reported!.single.field, "level");
    expect(reported!.single.operator, "equals");
    expect(reported!.single.value, "ERROR");
  });

  testWidgets("removing an active filter chip reports the list without it", (tester) async {
    List<LogFilter>? reported;
    await tester.pumpWidget(
      _wrap(
        FilterBuilder(
          filters: const [LogFilter(field: "message", operator: "contains", value: "timeout")],
          onChange: (f) => reported = f,
        ),
      ),
    );

    await tester.tap(find.text("Filters"));
    await tester.pump();

    expect(find.text("timeout"), findsOneWidget);

    await tester.tap(find.byIcon(Icons.close));
    await tester.pump();

    expect(reported, isNotNull);
    expect(reported, isEmpty);
  });

  testWidgets("Clear all empties the filter list", (tester) async {
    List<LogFilter>? reported;
    await tester.pumpWidget(
      _wrap(
        FilterBuilder(
          filters: const [
            LogFilter(field: "message", operator: "contains", value: "a"),
            LogFilter(field: "level", operator: "equals", value: "ERROR"),
          ],
          onChange: (f) => reported = f,
        ),
      ),
    );

    await tester.tap(find.text("Filters"));
    await tester.pump();

    await tester.tap(find.text("Clear all"));
    await tester.pump();

    expect(reported, isEmpty);
  });
}
