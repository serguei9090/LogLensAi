import "package:flutter/material.dart";
import "package:flutter_test/flutter_test.dart";

import "package:loglensai/widgets/molecules/dashboard_mode_toggle.dart";

Widget _wrap(Widget child) => MaterialApp(home: Scaffold(body: child));

void main() {
  testWidgets("renders both options without throwing", (tester) async {
    await tester.pumpWidget(
      _wrap(DashboardModeToggle(mode: DashboardMode.staticMode, onModeChange: (_) {})),
    );

    expect(find.text("Static"), findsOneWidget);
    expect(find.text("AI Insights"), findsOneWidget);
  });

  testWidgets("tapping the inactive option reports the new mode", (tester) async {
    DashboardMode? reported;
    await tester.pumpWidget(
      _wrap(
        DashboardModeToggle(
          mode: DashboardMode.staticMode,
          onModeChange: (m) => reported = m,
        ),
      ),
    );

    await tester.tap(find.text("AI Insights"));
    await tester.pump();

    expect(reported, DashboardMode.ai);
  });

  testWidgets("tapping the already-active option still reports itself", (tester) async {
    DashboardMode? reported;
    await tester.pumpWidget(
      _wrap(
        DashboardModeToggle(
          mode: DashboardMode.ai,
          onModeChange: (m) => reported = m,
        ),
      ),
    );

    await tester.tap(find.text("Static"));
    await tester.pump();

    expect(reported, DashboardMode.staticMode);
  });
}
