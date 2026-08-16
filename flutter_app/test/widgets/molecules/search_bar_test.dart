import "package:flutter/material.dart";
import "package:flutter_test/flutter_test.dart";
import "package:loglensai/theme/app_theme.dart";
import "package:loglensai/widgets/molecules/search_bar.dart";

Widget _host({
  required String value,
  required ValueChanged<String> onChange,
  Duration debounce = const Duration(milliseconds: 300),
}) {
  return MaterialApp(
    theme: AppTheme.dark,
    home: Scaffold(
      body: LogSearchBar(value: value, onChange: onChange, debounce: debounce),
    ),
  );
}

void main() {
  testWidgets("renders without throwing and shows placeholder", (tester) async {
    await tester.pumpWidget(_host(value: "", onChange: (_) {}));
    expect(find.byType(TextField), findsOneWidget);
  });

  testWidgets("does not fire onChange immediately while typing", (tester) async {
    final calls = <String>[];
    await tester.pumpWidget(_host(value: "", onChange: calls.add));

    await tester.enterText(find.byType(TextField), "level:error");
    await tester.pump(const Duration(milliseconds: 100));

    expect(calls, isEmpty);
  });

  testWidgets("fires onChange once after the debounce window elapses", (tester) async {
    final calls = <String>[];
    await tester.pumpWidget(_host(value: "", onChange: calls.add));

    await tester.enterText(find.byType(TextField), "level:error");
    await tester.pump(const Duration(milliseconds: 300));
    await tester.pump(const Duration(milliseconds: 50));

    expect(calls, ["level:error"]);
  });

  testWidgets("resets the debounce timer on each keystroke", (tester) async {
    final calls = <String>[];
    await tester.pumpWidget(_host(value: "", onChange: calls.add));

    await tester.enterText(find.byType(TextField), "lev");
    await tester.pump(const Duration(milliseconds: 200));
    await tester.enterText(find.byType(TextField), "level");
    await tester.pump(const Duration(milliseconds: 200));
    // Total elapsed since first keystroke > 300ms, but the second keystroke
    // should have restarted the timer, so no fire yet.
    expect(calls, isEmpty);

    await tester.pump(const Duration(milliseconds: 150));
    expect(calls, ["level"]);
  });

  testWidgets("clear button empties the field and fires onChange immediately", (tester) async {
    final calls = <String>[];
    await tester.pumpWidget(_host(value: "", onChange: calls.add));

    await tester.enterText(find.byType(TextField), "database");
    await tester.pump(const Duration(milliseconds: 350));
    expect(calls, ["database"]);

    await tester.tap(find.byIcon(Icons.close));
    await tester.pump();

    expect(calls, ["database", ""]);
    expect(find.text("database"), findsNothing);
  });
}
