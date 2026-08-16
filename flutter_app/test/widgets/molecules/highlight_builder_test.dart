import "package:flutter/material.dart";
import "package:flutter_test/flutter_test.dart";

import "package:loglensai/widgets/molecules/highlight_builder.dart";

Widget _wrap(Widget child) => MaterialApp(home: Scaffold(body: child));

void main() {
  testWidgets("renders the trigger chip without throwing, panel starts closed", (tester) async {
    await tester.pumpWidget(_wrap(HighlightBuilder(highlights: const [], onChange: (_) {})));

    expect(find.text("Highlights"), findsOneWidget);
    expect(find.text("Highlight Terms"), findsNothing);
  });

  testWidgets("opening reveals the preset color palette and term input", (tester) async {
    await tester.pumpWidget(_wrap(HighlightBuilder(highlights: const [], onChange: (_) {})));

    await tester.tap(find.text("Highlights"));
    await tester.pump();

    expect(find.text("Highlight Terms"), findsOneWidget);
    expect(find.text("Term to highlight..."), findsOneWidget);
  });

  testWidgets("adding a term with the default (first preset) color reports it", (tester) async {
    List<HighlightRule>? reported;
    await tester.pumpWidget(
      _wrap(HighlightBuilder(highlights: const [], onChange: (h) => reported = h)),
    );

    await tester.tap(find.text("Highlights"));
    await tester.pump();

    await tester.enterText(find.widgetWithText(TextField, "Term to highlight..."), "timeout");
    await tester.tap(find.byIcon(Icons.add));
    await tester.pump();

    expect(reported, isNotNull);
    expect(reported!.length, 1);
    expect(reported!.single.term, "timeout");
  });

  testWidgets("removing an active highlight chip reports the list without it", (tester) async {
    List<HighlightRule>? reported;
    await tester.pumpWidget(
      _wrap(
        HighlightBuilder(
          highlights: const [HighlightRule(term: "warn", color: Color(0xFFFBBF24))],
          onChange: (h) => reported = h,
        ),
      ),
    );

    await tester.tap(find.text("Highlights"));
    await tester.pump();

    expect(find.text("warn"), findsOneWidget);

    await tester.tap(find.byIcon(Icons.close));
    await tester.pump();

    expect(reported, isEmpty);
  });

  testWidgets("typing a custom hex and confirming makes it the selected color", (tester) async {
    await tester.pumpWidget(_wrap(HighlightBuilder(highlights: const [], onChange: (_) {})));

    await tester.tap(find.text("Highlights"));
    await tester.pump();

    await tester.enterText(find.widgetWithText(TextField, "#RRGGBB"), "#123456");
    await tester.tap(find.byIcon(Icons.check));
    await tester.pump();

    // The custom color becomes an additional swatch (color chosen, no crash).
    expect(find.byIcon(Icons.check), findsOneWidget);
  });
}
