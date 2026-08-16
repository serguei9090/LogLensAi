import "package:flutter/material.dart";
import "package:flutter_test/flutter_test.dart";

import "package:loglensai/theme/app_theme.dart";
import "package:loglensai/widgets/atoms/a2ui_renderer.dart";

Widget _wrap(Widget child) {
  return MaterialApp(theme: AppTheme.dark, home: Scaffold(body: child));
}

void main() {
  testWidgets("renders nothing for a null payload", (tester) async {
    await tester.pumpWidget(_wrap(const A2UIRenderer(payload: null)));

    expect(find.byType(SizedBox), findsOneWidget);
    expect(find.byType(Text), findsNothing);
  });

  testWidgets("renders a text node", (tester) async {
    await tester.pumpWidget(
      _wrap(const A2UIRenderer(payload: {"type": "text", "text": "Hello world"})),
    );

    expect(find.text("Hello world"), findsOneWidget);
  });

  testWidgets("renders a metric node with its static value", (tester) async {
    await tester.pumpWidget(
      _wrap(
        const A2UIRenderer(
          payload: {
            "type": "metric",
            "label": "Total Logs",
            "props": {"value": "1,204"},
          },
        ),
      ),
    );

    expect(find.text("TOTAL LOGS"), findsOneWidget);
    expect(find.text("1,204"), findsOneWidget);
  });

  testWidgets("renders a data_table node with rows", (tester) async {
    await tester.pumpWidget(
      _wrap(
        const A2UIRenderer(
          payload: {
            "type": "data_table",
            "label": "Recent Errors",
            "props": {
              "rows": [
                {"level": "ERROR", "message": "boom"},
              ],
            },
          },
        ),
      ),
    );

    expect(find.text("RECENT ERRORS"), findsOneWidget);
    expect(find.textContaining("boom"), findsOneWidget);
  });

  testWidgets("data_table with no rows shows an empty state", (tester) async {
    await tester.pumpWidget(
      _wrap(const A2UIRenderer(payload: {"type": "data_table", "label": "Empty"})),
    );

    expect(find.text("No data"), findsOneWidget);
  });

  testWidgets("recurses into a card's children", (tester) async {
    await tester.pumpWidget(
      _wrap(
        const A2UIRenderer(
          payload: {
            "type": "card",
            "label": "Group",
            "children": [
              {"type": "text", "text": "child one"},
              {"type": "text", "text": "child two"},
            ],
          },
        ),
      ),
    );

    expect(find.text("GROUP"), findsOneWidget);
    expect(find.text("child one"), findsOneWidget);
    expect(find.text("child two"), findsOneWidget);
  });

  testWidgets("tapping a button invokes onAction with its action map", (tester) async {
    Map<String, dynamic>? captured;
    await tester.pumpWidget(
      _wrap(
        A2UIRenderer(
          payload: const {
            "type": "button",
            "label": "Run",
            "action": {"type": "run_query"},
          },
          onAction: (action) => captured = action,
        ),
      ),
    );

    await tester.tap(find.text("RUN"));
    await tester.pump();

    expect(captured, {"type": "run_query"});
  });

  testWidgets("unknown node types render nothing (graceful fallback)", (tester) async {
    await tester.pumpWidget(_wrap(const A2UIRenderer(payload: {"type": "totally_unknown"})));

    expect(find.byType(Text), findsNothing);
  });

  testWidgets("malformed markup payload shows the fallback message", (tester) async {
    await tester.pumpWidget(
      _wrap(const A2UIRenderer(payload: {"type": "markup", "raw": "not a real tag"})),
    );

    expect(find.text("[Malformed A2UI Blueprint]"), findsOneWidget);
  });

  testWidgets("well-formed markup payload parses and renders", (tester) async {
    await tester.pumpWidget(
      _wrap(
        const A2UIRenderer(
          payload: {"type": "markup", "raw": 'text value="Parsed from markup"'},
        ),
      ),
    );

    expect(find.text("Parsed from markup"), findsOneWidget);
  });
}
