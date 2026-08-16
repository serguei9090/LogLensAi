import "package:flutter/material.dart";
import "package:flutter_test/flutter_test.dart";
import "package:loglensai/theme/app_theme.dart";
import "package:loglensai/widgets/molecules/time_range_picker.dart";

Widget _host({required TimeRange value, required ValueChanged<TimeRange> onChange}) {
  return MaterialApp(
    theme: AppTheme.dark,
    home: Scaffold(body: TimeRangePicker(value: value, onChange: onChange)),
  );
}

void main() {
  testWidgets("shows 'All Time' when the range is unset", (tester) async {
    await tester.pumpWidget(
      _host(value: const TimeRange(start: "", end: ""), onChange: (_) {}),
    );

    expect(find.text("All Time"), findsOneWidget);
  });

  testWidgets("shows the range's label when one is set", (tester) async {
    await tester.pumpWidget(
      _host(
        value: const TimeRange(start: "2026-08-14T00:00:00", end: "", label: "Last 24 hrs"),
        onChange: (_) {},
      ),
    );

    expect(find.text("Last 24 hrs"), findsOneWidget);
  });

  testWidgets("tapping the trigger opens the dialog with presets", (tester) async {
    await tester.pumpWidget(
      _host(value: const TimeRange(start: "", end: ""), onChange: (_) {}),
    );

    await tester.tap(find.text("All Time"));
    await tester.pumpAndSettle();

    expect(find.text("Time Range"), findsOneWidget);
    expect(find.text("Last 15 min"), findsOneWidget);
    expect(find.text("Last 1 hour"), findsOneWidget);
    expect(find.text("Last 4 hours"), findsOneWidget);
    expect(find.text("Last 24 hrs"), findsOneWidget);
    expect(find.text("Last 7 days"), findsOneWidget);
    expect(find.text("Today"), findsOneWidget);
  });

  testWidgets("selecting a preset closes the dialog and reports the range", (tester) async {
    TimeRange? result;
    await tester.pumpWidget(
      _host(
        value: const TimeRange(start: "", end: ""),
        onChange: (r) => result = r,
      ),
    );

    await tester.tap(find.text("All Time"));
    await tester.pumpAndSettle();

    await tester.tap(find.text("Last 1 hour"));
    await tester.pumpAndSettle();

    expect(find.text("Time Range"), findsNothing);
    expect(result, isNotNull);
    expect(result!.label, "Last 1 hour");
    expect(result!.start, isNotEmpty);
    expect(result!.end, isEmpty);

    // The reported value should now drive the trigger's own label.
    await tester.pumpWidget(_host(value: result!, onChange: (_) {}));
    expect(find.text("Last 1 hour"), findsOneWidget);
  });

  testWidgets("Reset resets the range back to All Time", (tester) async {
    TimeRange? result;
    await tester.pumpWidget(
      _host(
        value: const TimeRange(start: "2026-08-01T00:00:00", end: "", label: "Last 7 days"),
        onChange: (r) => result = r,
      ),
    );

    await tester.tap(find.text("Last 7 days"));
    await tester.pumpAndSettle();

    await tester.tap(find.text("Reset (All Time)"));
    await tester.pumpAndSettle();

    expect(result, const TimeRange(start: "", end: ""));
  });

  testWidgets("Set Window is disabled until a start date is picked", (tester) async {
    await tester.pumpWidget(
      _host(value: const TimeRange(start: "", end: ""), onChange: (_) {}),
    );

    await tester.tap(find.text("All Time"));
    await tester.pumpAndSettle();

    final setWindowButton = tester.widget<ElevatedButton>(
      find.widgetWithText(ElevatedButton, "Set Window"),
    );
    expect(setWindowButton.onPressed, isNull);
  });
}
