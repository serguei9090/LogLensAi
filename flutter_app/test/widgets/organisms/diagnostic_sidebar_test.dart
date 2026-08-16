import "package:flutter/material.dart";
import "package:flutter_test/flutter_test.dart";

import "package:loglensai/theme/app_theme.dart";
import "package:loglensai/widgets/organisms/diagnostic_sidebar.dart";

Widget _wrap(Widget child) =>
    MaterialApp(theme: AppTheme.dark, home: Scaffold(body: child));

void main() {
  testWidgets("fixed 384px width", (tester) async {
    expect(DiagnosticSidebar.width, 384);
  });

  testWidgets("loading state shows skeleton bars, no data", (tester) async {
    await tester.pumpWidget(
      _wrap(
        const DiagnosticSidebar(
          open: true,
          onClose: _noop,
          data: null,
          loading: true,
        ),
      ),
    );
    await tester.pump();

    expect(find.text("AI Diagnostics"), findsOneWidget);
    expect(find.text("Select a cluster to analyze"), findsNothing);
    expect(find.byType(FractionallySizedBox), findsNWidgets(3));
  });

  testWidgets("empty state (no data, not loading) shows placeholder", (tester) async {
    await tester.pumpWidget(
      _wrap(
        const DiagnosticSidebar(
          open: true,
          onClose: _noop,
          data: null,
          loading: false,
        ),
      ),
    );
    await tester.pump();

    expect(find.text("Select a cluster to analyze"), findsOneWidget);
  });

  testWidgets("populated state renders root cause, summary, and numbered actions", (
    tester,
  ) async {
    const data = DiagnosticData(
      summary: "Disk usage spiked to 98%.",
      rootCause: "A runaway log rotation job filled /var/log.",
      recommendedActions: ["Rotate logs manually", "Add disk alerting", "Increase volume size"],
    );

    await tester.pumpWidget(
      _wrap(
        const DiagnosticSidebar(open: true, onClose: _noop, data: data, loading: false),
      ),
    );
    await tester.pump();

    expect(find.text("Root Cause".toUpperCase()), findsOneWidget);
    expect(find.text("A runaway log rotation job filled /var/log."), findsOneWidget);
    expect(find.text("SUMMARY"), findsOneWidget);
    expect(find.text("Disk usage spiked to 98%."), findsOneWidget);
    expect(find.text("Recommended Actions".toUpperCase()), findsOneWidget);
    expect(find.text("Rotate logs manually"), findsOneWidget);
    expect(find.text("2."), findsOneWidget);
    expect(find.text("Increase volume size"), findsOneWidget);
  });

  testWidgets("close button fires onClose", (tester) async {
    var closed = false;
    await tester.pumpWidget(
      _wrap(
        DiagnosticSidebar(
          open: true,
          onClose: () => closed = true,
          data: null,
          loading: false,
        ),
      ),
    );
    await tester.pump();

    await tester.tap(find.byIcon(Icons.close));
    await tester.pump();

    expect(closed, isTrue);
  });

  testWidgets("closed state still builds (slid off-screen) without throwing", (tester) async {
    await tester.pumpWidget(
      _wrap(
        const DiagnosticSidebar(open: false, onClose: _noop, data: null, loading: false),
      ),
    );
    await tester.pump();

    expect(find.byType(DiagnosticSidebar), findsOneWidget);
    final slide = tester.widget<AnimatedSlide>(find.byType(AnimatedSlide));
    expect(slide.offset, const Offset(1, 0));
  });
}

void _noop() {}
