import "package:flutter/material.dart";
import "package:flutter_test/flutter_test.dart";

import "package:loglensai/models/settings.dart";
import "package:loglensai/widgets/molecules/facet_extraction_settings.dart";

Widget _wrap(Widget child) => MaterialApp(home: Scaffold(body: SingleChildScrollView(child: child)));

void main() {
  testWidgets("renders existing rules without throwing", (tester) async {
    await tester.pumpWidget(
      _wrap(
        FacetExtractionSettings(
          rules: const [
            FacetExtractionRule(name: "user_id", regex: r"user_id=(\d+)", group: 1, enabled: true),
          ],
          onChange: (_) {},
        ),
      ),
    );

    expect(find.text("Custom Facet Extraction"), findsOneWidget);
    expect(find.text("user_id"), findsOneWidget);
  });

  testWidgets("Show System Facets reveals the always-on heuristics panel", (tester) async {
    await tester.pumpWidget(
      _wrap(FacetExtractionSettings(rules: const [], onChange: (_) {})),
    );

    expect(find.text("ACTIVE SYSTEM HEURISTICS (ALWAYS ON)"), findsNothing);

    await tester.tap(find.text("Show System Facets"));
    await tester.pump();

    expect(find.text("ACTIVE SYSTEM HEURISTICS (ALWAYS ON)"), findsOneWidget);
  });

  testWidgets("adding a rule with name+regex reports the appended list", (tester) async {
    List<FacetExtractionRule>? reported;
    await tester.pumpWidget(
      _wrap(
        FacetExtractionSettings(
          rules: const [],
          onChange: (rules) => reported = rules,
        ),
      ),
    );

    await tester.enterText(find.widgetWithText(TextField, "New facet..."), "req_id");
    await tester.enterText(find.widgetWithText(TextField, "Regex pattern..."), r"req_id=(\w+)");
    await tester.pump();

    await tester.tap(find.byIcon(Icons.add));
    await tester.pump();

    expect(reported, isNotNull);
    expect(reported!.length, 1);
    expect(reported!.single.name, "req_id");
    expect(reported!.single.enabled, isTrue);
  });

  testWidgets("deleting a rule reports the list without it", (tester) async {
    List<FacetExtractionRule>? reported;
    await tester.pumpWidget(
      _wrap(
        FacetExtractionSettings(
          rules: const [
            FacetExtractionRule(name: "a", regex: "a", group: 1, enabled: true),
            FacetExtractionRule(name: "b", regex: "b", group: 1, enabled: true),
          ],
          onChange: (rules) => reported = rules,
        ),
      ),
    );

    await tester.tap(find.byIcon(Icons.delete_outline).first);
    await tester.pump();

    expect(reported, isNotNull);
    expect(reported!.length, 1);
    expect(reported!.single.name, "b");
  });

  testWidgets("toggling a rule flips its enabled flag", (tester) async {
    List<FacetExtractionRule>? reported;
    await tester.pumpWidget(
      _wrap(
        FacetExtractionSettings(
          rules: const [
            FacetExtractionRule(name: "a", regex: "a", group: 1, enabled: true),
          ],
          onChange: (rules) => reported = rules,
        ),
      ),
    );

    await tester.tap(find.byIcon(Icons.toggle_on));
    await tester.pump();

    expect(reported!.single.enabled, isFalse);
  });
}
