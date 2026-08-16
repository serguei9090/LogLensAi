import "package:flutter/material.dart";
import "package:flutter_test/flutter_test.dart";

import "package:loglensai/widgets/molecules/facet_list.dart";

Widget _wrap(Widget child) => MaterialApp(home: Scaffold(body: child));

void main() {
  testWidgets("shows the empty state when there are no facets", (tester) async {
    await tester.pumpWidget(_wrap(const FacetList(availableFacets: {})));

    expect(find.text("No metadata facets detected in current view."), findsOneWidget);
  });

  testWidgets("renders facet keys and, once expanded, their values", (tester) async {
    await tester.pumpWidget(
      _wrap(
        const FacetList(
          availableFacets: {
            "status": [FacetValue(value: "200", count: 10), FacetValue(value: "500", count: 2)],
          },
          initiallyExpandedKeys: {},
        ),
      ),
    );

    expect(find.text("status"), findsOneWidget);
    expect(find.text("200"), findsNothing);

    await tester.tap(find.text("status"));
    await tester.pump();

    expect(find.text("200"), findsOneWidget);
    expect(find.text("500"), findsOneWidget);
  });

  testWidgets("tapping a facet value reports (key, value) via onApplyFilter", (tester) async {
    String? key;
    String? value;
    await tester.pumpWidget(
      _wrap(
        FacetList(
          availableFacets: const {
            "level": [FacetValue(value: "ERROR", count: 5)],
          },
          onApplyFilter: (k, v) {
            key = k;
            value = v;
          },
        ),
      ),
    );

    await tester.tap(find.text("ERROR"));
    await tester.pump();

    expect(key, "level");
    expect(value, "ERROR");
  });
}
