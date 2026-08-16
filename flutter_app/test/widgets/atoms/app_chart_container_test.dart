import "package:flutter/material.dart";
import "package:flutter_test/flutter_test.dart";

import "package:loglensai/theme/app_theme.dart";
import "package:loglensai/widgets/atoms/app_chart_container.dart";

Widget _wrap(Widget child) {
  return MaterialApp(theme: AppTheme.dark, home: Scaffold(body: child));
}

void main() {
  testWidgets("renders its child inside the themed container", (tester) async {
    await tester.pumpWidget(
      _wrap(const AppChartContainer(child: Text("chart placeholder"))),
    );

    expect(find.text("chart placeholder"), findsOneWidget);

    final container = tester.widget<Container>(find.byType(Container).first);
    final decoration = container.decoration! as BoxDecoration;
    expect(decoration.color, AppColors.bgSurface.withValues(alpha: 0.4));
    expect(decoration.borderRadius, BorderRadius.circular(AppRadius.lg));
  });

  testWidgets("shows no loading overlay by default", (tester) async {
    await tester.pumpWidget(
      _wrap(const AppChartContainer(child: Text("chart"))),
    );

    expect(find.text("Synchronizing..."), findsNothing);
    expect(find.byType(CircularProgressIndicator), findsNothing);
  });

  testWidgets("shows the loading overlay when loading is true", (tester) async {
    await tester.pumpWidget(
      _wrap(const AppChartContainer(loading: true, child: Text("chart"))),
    );

    expect(find.text("Synchronizing..."), findsOneWidget);
    expect(find.byType(CircularProgressIndicator), findsOneWidget);
    // Underlying content stays mounted (just visually dimmed by the overlay).
    expect(find.text("chart"), findsOneWidget);
  });

  testWidgets("applies a fixed height when provided", (tester) async {
    await tester.pumpWidget(
      _wrap(const AppChartContainer(height: 240, child: Text("chart"))),
    );

    final container = tester.widget<Container>(find.byType(Container).first);
    expect(container.constraints!.maxHeight, 240);
    expect(container.constraints!.minHeight, 240);
  });
}
