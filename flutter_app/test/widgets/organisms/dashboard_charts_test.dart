import "package:fl_chart/fl_chart.dart";
import "package:flutter/gestures.dart";
import "package:flutter/material.dart";
import "package:flutter_test/flutter_test.dart";

import "package:loglensai/models/dashboard_stats.dart";
import "package:loglensai/theme/app_theme.dart";
import "package:loglensai/widgets/organisms/dashboard_charts.dart";

const List<String> _kLevels = ["DEBUG", "INFO", "WARN", "ERROR"];

DashboardStats _sampleStats() {
  return DashboardStats(
    totalLogs: 100,
    levelCounts: const {"DEBUG": 10, "INFO": 50, "WARN": 25, "ERROR": 15},
    timeSeries: [
      DashboardTimeSeriesPoint(
        timestamp: "2026-08-16 08:00",
        rawLevelCounts: const {"DEBUG": 2, "INFO": 10, "WARN": 5, "ERROR": 3},
      ),
      DashboardTimeSeriesPoint(
        timestamp: "2026-08-16 09:00",
        rawLevelCounts: const {"DEBUG": 3, "INFO": 15, "WARN": 8, "ERROR": 4},
      ),
      DashboardTimeSeriesPoint(
        timestamp: "2026-08-16 10:00",
        rawLevelCounts: const {"DEBUG": 5, "INFO": 25, "WARN": 12, "ERROR": 8},
      ),
    ],
    bucketInterval: "1 hour",
    timeBounds: const DashboardTimeBounds(min: "2026-08-16 08:00", max: "2026-08-16 10:00"),
  );
}

Widget _wrap(Widget child) {
  return MaterialApp(
    theme: AppTheme.dark,
    home: Scaffold(body: SizedBox(height: 700, child: SingleChildScrollView(child: child))),
  );
}

void main() {
  testWidgets("renders volume, level-distribution, and error-rate charts without throwing", (
    tester,
  ) async {
    await tester.pumpWidget(
      _wrap(DashboardCharts(stats: _sampleStats(), onZoom: (start, end) {}, onReset: () {})),
    );
    await tester.pumpAndSettle();

    expect(find.byType(BarChart), findsOneWidget);
    expect(find.byType(PieChart), findsOneWidget);
    expect(find.byType(LineChart), findsOneWidget);
    expect(find.text("SEVERITY OVER TIME"), findsOneWidget);
    expect(find.text("LEVEL DISTRIBUTION"), findsOneWidget);
    expect(find.text("ERROR RATE TREND"), findsOneWidget);
  });

  testWidgets("renders the loading overlay instead of throwing when stats is null", (
    tester,
  ) async {
    await tester.pumpWidget(_wrap(DashboardCharts(stats: null, onZoom: (start, end) {}, onReset: () {})));
    await tester.pump();

    expect(find.text("Synchronizing..."), findsWidgets);
    // No chart data yet -- charts should not be built against a null stats.
    expect(find.byType(BarChart), findsNothing);
  });

  testWidgets("renders 'no data' placeholders instead of throwing for empty stats", (
    tester,
  ) async {
    await tester.pumpWidget(
      _wrap(
        DashboardCharts(
          stats: const DashboardStats(),
          onZoom: (start, end) {},
          onReset: () {},
        ),
      ),
    );
    await tester.pumpAndSettle();

    expect(find.text("NO TIME DATA AVAILABLE"), findsNWidgets(2));
    expect(find.text("NO DATA"), findsOneWidget);
  });

  testWidgets("level-distribution pie section colors match AppColors.forLogLevel per level", (
    tester,
  ) async {
    await tester.pumpWidget(
      _wrap(DashboardCharts(stats: _sampleStats(), onZoom: (start, end) {}, onReset: () {})),
    );
    await tester.pumpAndSettle();

    final pie = tester.widget<PieChart>(find.byType(PieChart));
    final sections = pie.data.sections;
    expect(sections.length, _kLevels.length);
    for (var i = 0; i < sections.length; i++) {
      expect(sections[i].color, AppColors.forLogLevel(_kLevels[i]));
    }
  });

  testWidgets("volume chart stacks bar segments using AppColors.forLogLevel per level", (
    tester,
  ) async {
    await tester.pumpWidget(
      _wrap(DashboardCharts(stats: _sampleStats(), onZoom: (start, end) {}, onReset: () {})),
    );
    await tester.pumpAndSettle();

    final barChart = tester.widget<BarChart>(find.byType(BarChart));
    final stackItems = barChart.data.barGroups.first.barRods.first.rodStackItems;
    expect(stackItems.length, _kLevels.length);
    for (var i = 0; i < stackItems.length; i++) {
      expect(stackItems[i].color, AppColors.forLogLevel(_kLevels[i]));
    }
  });

  testWidgets("error-rate trend line is colored with AppColors.error", (tester) async {
    await tester.pumpWidget(
      _wrap(DashboardCharts(stats: _sampleStats(), onZoom: (start, end) {}, onReset: () {})),
    );
    await tester.pumpAndSettle();

    final lineChart = tester.widget<LineChart>(find.byType(LineChart));
    expect(lineChart.data.lineBarsData.single.color, AppColors.error);
  });

  testWidgets("Reset Zoom button appears when filtered and invokes onReset when tapped", (
    tester,
  ) async {
    var resetCalled = false;
    await tester.pumpWidget(
      _wrap(
        DashboardCharts(
          stats: _sampleStats(),
          timeBounds: const DashboardTimeBounds(min: "2026-08-16 08:00", max: "2026-08-16 10:00"),
          timeRange: const DashboardTimeRange(start: "2026-08-16 08:00", end: "2026-08-16 09:00"),
          onZoom: (start, end) {},
          onReset: () => resetCalled = true,
        ),
      ),
    );
    await tester.pumpAndSettle();

    expect(find.text("Reset Zoom"), findsOneWidget);
    await tester.tap(find.text("Reset Zoom"));
    await tester.pump();

    expect(resetCalled, isTrue);
  });

  testWidgets("Reset Zoom button is hidden when the active range equals the full bounds", (
    tester,
  ) async {
    await tester.pumpWidget(
      _wrap(
        DashboardCharts(
          stats: _sampleStats(),
          timeBounds: const DashboardTimeBounds(min: "2026-08-16 08:00", max: "2026-08-16 10:00"),
          timeRange: const DashboardTimeRange(start: "2026-08-16 08:00", end: "2026-08-16 10:00"),
          onZoom: (start, end) {},
          onReset: () {},
        ),
      ),
    );
    await tester.pumpAndSettle();

    expect(find.text("Reset Zoom"), findsNothing);
  });

  testWidgets(
    "the volume chart's wired touchCallback invokes onZoom with the tapped bucket's range",
    (tester) async {
      // Rather than driving fl_chart's internal PanGestureRecognizer/tap
      // detector through synthetic pointer events (brittle: exact hit-testing
      // depends on fl_chart's internal layout math, which isn't part of the
      // widget's public contract), this grabs the actual `touchCallback`
      // fl_chart was wired up with (i.e. DashboardCharts's `_handleBarTouch`)
      // straight off the built `BarChart` widget and invokes it with a
      // synthetic single-bucket tap-up -- exercising the exact same
      // onZoom-emitting code path a real tap would, without depending on
      // fl_chart's gesture-arena internals.
      String? zoomStart;
      String? zoomEnd;
      await tester.pumpWidget(
        _wrap(
          DashboardCharts(
            stats: DashboardStats(
              totalLogs: 20,
              levelCounts: const {"INFO": 20},
              timeSeries: [
                DashboardTimeSeriesPoint(
                  timestamp: "2026-08-16 08:00",
                  rawLevelCounts: const {"INFO": 20},
                ),
              ],
              bucketInterval: "1 hour",
            ),
            onZoom: (start, end) {
              zoomStart = start;
              zoomEnd = end;
            },
            onReset: () {},
          ),
        ),
      );
      await tester.pumpAndSettle();

      final barChart = tester.widget<BarChart>(find.byType(BarChart));
      final touchCallback = barChart.data.barTouchData.touchCallback;
      expect(touchCallback, isNotNull);

      final group = barChart.data.barGroups.single;
      final rod = group.barRods.single;
      touchCallback!(
        FlTapUpEvent(TapUpDetails(kind: PointerDeviceKind.touch, globalPosition: Offset.zero)),
        BarTouchResponse(
          BarTouchedSpot(
            group,
            0,
            rod,
            0,
            rod.rodStackItems.first,
            0,
            const FlSpot(0, 0),
            Offset.zero,
          ),
        ),
      );
      await tester.pump();

      expect(zoomStart, "2026-08-16T08:00:00");
      expect(zoomEnd, "2026-08-16T08:59:59");
    },
  );
}
