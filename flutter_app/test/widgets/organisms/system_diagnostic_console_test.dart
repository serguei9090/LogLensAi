import "package:flutter/material.dart";
import "package:flutter_riverpod/flutter_riverpod.dart";
import "package:flutter_test/flutter_test.dart";

import "package:loglensai/providers/debug_provider.dart";
import "package:loglensai/theme/app_theme.dart";
import "package:loglensai/widgets/organisms/system_diagnostic_console.dart";

Widget _wrap(ProviderContainer container, Widget child) {
  return UncontrolledProviderScope(
    container: container,
    child: MaterialApp(theme: AppTheme.dark, home: Scaffold(body: child)),
  );
}

void main() {
  testWidgets("renders nothing when the debug panel is closed", (tester) async {
    final container = ProviderContainer();
    addTearDown(container.dispose);

    await tester.pumpWidget(_wrap(container, const SystemDiagnosticConsole()));

    expect(find.text("System Diagnostic"), findsNothing);
  });

  testWidgets("renders nothing when disabled even if the panel is marked open", (tester) async {
    final container = ProviderContainer();
    addTearDown(container.dispose);
    container.read(debugProvider.notifier).setOpen(true);

    await tester.pumpWidget(_wrap(container, const SystemDiagnosticConsole(enabled: false)));

    expect(find.text("System Diagnostic"), findsNothing);
  });

  testWidgets("shows the empty state when open with no logs", (tester) async {
    final container = ProviderContainer();
    addTearDown(container.dispose);
    container.read(debugProvider.notifier).setOpen(true);

    await tester.pumpWidget(_wrap(container, const SystemDiagnosticConsole()));
    await tester.pump();

    expect(find.text("System Diagnostic"), findsOneWidget);
    expect(find.text("WAITING FOR EVENTS..."), findsOneWidget);
    expect(find.text("0 entries recorded".toUpperCase()), findsOneWidget);
  });

  testWidgets("lists recorded log entries and expands data on tap", (tester) async {
    final container = ProviderContainer();
    addTearDown(container.dispose);
    final notifier = container.read(debugProvider.notifier)
      ..setOpen(true)
      ..addLog(level: "error", source: "sidecar", message: "RPC failed", data: {"code": 500});

    await tester.pumpWidget(_wrap(container, const SystemDiagnosticConsole()));
    await tester.pump();

    expect(find.text("RPC failed"), findsOneWidget);
    expect(find.text("1 entries recorded".toUpperCase()), findsOneWidget);

    // Data is collapsed by default.
    expect(find.textContaining('"code"'), findsNothing);

    await tester.tap(find.byIcon(Icons.expand_more));
    await tester.pump();

    expect(find.textContaining('"code"'), findsOneWidget);
    expect(notifier, isNotNull);
  });

  testWidgets("Clear Logs empties the ring buffer", (tester) async {
    final container = ProviderContainer();
    addTearDown(container.dispose);
    container.read(debugProvider.notifier)
      ..setOpen(true)
      ..addLog(level: "info", source: "system", message: "boot");

    await tester.pumpWidget(_wrap(container, const SystemDiagnosticConsole()));
    await tester.pump();

    expect(find.text("boot"), findsOneWidget);

    await tester.tap(find.byTooltip("Clear Logs"));
    await tester.pump();

    expect(find.text("boot"), findsNothing);
    expect(container.read(debugProvider).logs, isEmpty);
  });

  testWidgets("the close button sets debugProvider.isOpen to false", (tester) async {
    final container = ProviderContainer();
    addTearDown(container.dispose);
    container.read(debugProvider.notifier).setOpen(true);

    await tester.pumpWidget(_wrap(container, const SystemDiagnosticConsole()));
    await tester.pump();

    await tester.tap(find.byIcon(Icons.close));
    await tester.pump();

    expect(container.read(debugProvider).isOpen, isFalse);
  });
}
