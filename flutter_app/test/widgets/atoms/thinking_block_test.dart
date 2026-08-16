import "package:flutter/material.dart";
import "package:flutter_test/flutter_test.dart";

import "package:loglensai/theme/app_theme.dart";
import "package:loglensai/widgets/atoms/thinking_block.dart";

Widget _wrap(Widget child) {
  return MaterialApp(theme: AppTheme.dark, home: Scaffold(body: child));
}

void main() {
  testWidgets("renders nothing when there's no content and it isn't streaming", (tester) async {
    await tester.pumpWidget(_wrap(const ThinkingBlock(content: "")));

    expect(find.byType(SizedBox), findsOneWidget);
    expect(find.text("thought process"), findsNothing);
  });

  testWidgets("collapsed by default, shows 'thought process' header with no duration", (
    tester,
  ) async {
    await tester.pumpWidget(_wrap(const ThinkingBlock(content: "reasoning goes here")));

    expect(find.text("thought process"), findsOneWidget);
    expect(find.text("reasoning goes here"), findsNothing);
  });

  testWidgets("shows the formatted duration once durationMs is known", (tester) async {
    await tester.pumpWidget(
      _wrap(const ThinkingBlock(content: "done thinking", durationMs: 2300)),
    );

    expect(find.text("thought for 2.3 seconds"), findsOneWidget);
  });

  testWidgets("tapping the header expands and reveals the reasoning chain", (tester) async {
    await tester.pumpWidget(
      _wrap(const ThinkingBlock(content: "full reasoning text", durationMs: 500)),
    );

    expect(find.text("full reasoning text"), findsNothing);

    await tester.tap(find.text("thought for 0.5 seconds"));
    await tester.pumpAndSettle();

    expect(find.text("full reasoning text"), findsOneWidget);
    expect(find.text("REASONING CHAIN"), findsOneWidget);
  });

  testWidgets("auto-expands and shows 'thinking…' while isStreaming", (tester) async {
    await tester.pumpWidget(
      _wrap(const ThinkingBlock(content: "partial...", isStreaming: true)),
    );
    await tester.pump();

    expect(find.text("thinking…"), findsOneWidget);
    expect(find.text("partial..."), findsOneWidget);
  });

  testWidgets("auto-collapses ~2s after streaming stops", (tester) async {
    await tester.pumpWidget(
      _wrap(const ThinkingBlock(content: "was streaming", isStreaming: true)),
    );
    await tester.pump();
    expect(find.text("was streaming"), findsOneWidget);

    await tester.pumpWidget(
      _wrap(const ThinkingBlock(content: "was streaming", isStreaming: false, durationMs: 100)),
    );
    await tester.pump();
    // Still expanded immediately after streaming flips off.
    expect(find.text("was streaming"), findsOneWidget);

    await tester.pump(const Duration(milliseconds: 2100));
    await tester.pumpAndSettle();

    expect(find.text("was streaming"), findsNothing);
  });
}
