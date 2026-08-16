import "package:flutter/material.dart";
import "package:flutter_riverpod/flutter_riverpod.dart";
import "package:flutter_test/flutter_test.dart";

import "package:loglensai/providers/ingestion_provider.dart";
import "package:loglensai/theme/app_theme.dart";
import "package:loglensai/widgets/atoms/tail_switch.dart";
import "package:loglensai/widgets/organisms/import_feed_modal.dart";

Widget _wrap(ProviderContainer container, Widget child) {
  return UncontrolledProviderScope(
    container: container,
    child: MaterialApp(theme: AppTheme.dark, home: Scaffold(body: child)),
  );
}

ImportFeedModal _modal({
  void Function(String path, bool tail)? onImportLocal,
  void Function(String host, int port, String user, String pass, String path, bool tail)? onImportSSH,
  void Function(String logs)? onIngestManual,
  void Function(String name, {required bool syslog, required bool http})? onImportLive,
}) {
  return ImportFeedModal(
    onImportLocal: onImportLocal ?? (_, _) {},
    onImportSSH: onImportSSH ?? (_, _, _, _, _, _) {},
    onIngestManual: onIngestManual ?? (_) {},
    onImportLive: onImportLive ?? (_, {required syslog, required http}) {},
  );
}

void main() {
  // The Live tab's protocol cards + "Ready to Ingest" endpoint preview
  // overflow the default 800x600 test surface (same rationale as
  // `custom_parser_modal_test.dart`). Widen the surface for every test.
  setUp(() {
    final binding = TestWidgetsFlutterBinding.ensureInitialized();
    binding.platformDispatcher.views.first.physicalSize = const Size(1400, 1100);
    binding.platformDispatcher.views.first.devicePixelRatio = 1.0;
  });
  tearDown(() {
    final binding = TestWidgetsFlutterBinding.ensureInitialized();
    binding.platformDispatcher.views.first.resetPhysicalSize();
    binding.platformDispatcher.views.first.resetDevicePixelRatio();
  });

  testWidgets("renders nothing when the import modal is closed", (tester) async {
    final container = ProviderContainer();
    addTearDown(container.dispose);

    await tester.pumpWidget(_wrap(container, _modal()));
    await tester.pump();

    expect(find.text("Ingest Source"), findsNothing);
  });

  testWidgets("local tab: entering a path enables Initialize and invokes onImportLocal with the tail flag", (
    tester,
  ) async {
    final container = ProviderContainer();
    addTearDown(container.dispose);
    container.read(ingestionProvider.notifier).setImportOpen(true);

    String? importedPath;
    bool? importedTail;

    await tester.pumpWidget(
      _wrap(
        container,
        _modal(
          onImportLocal: (path, tail) {
            importedPath = path;
            importedTail = tail;
          },
        ),
      ),
    );
    await tester.pump();

    expect(find.text("Ingest Source"), findsOneWidget);
    final initializeFinder = find.widgetWithText(ElevatedButton, "Initialize");
    expect(tester.widget<ElevatedButton>(initializeFinder).onPressed, isNull);

    await tester.enterText(find.byType(TextField), "/var/log/app.log");
    await tester.pump();

    expect(tester.widget<ElevatedButton>(initializeFinder).onPressed, isNotNull);

    await tester.tap(find.byType(TailSwitch));
    await tester.pump();

    await tester.tap(initializeFinder);
    await tester.pump();

    expect(importedPath, "/var/log/app.log");
    expect(importedTail, isTrue);
  });

  testWidgets("ssh tab: filling the required fields enables Connect and invokes onImportSSH", (tester) async {
    final container = ProviderContainer();
    addTearDown(container.dispose);
    container.read(ingestionProvider.notifier).setImportOpen(true);

    String? host;
    int? port;
    String? user;
    String? path;
    bool? tail;

    await tester.pumpWidget(
      _wrap(
        container,
        _modal(
          onImportSSH: (h, p, u, pw, pt, t) {
            host = h;
            port = p;
            user = u;
            path = pt;
            tail = t;
          },
        ),
      ),
    );
    await tester.pump();

    await tester.tap(find.text("SSH"));
    await tester.pump();

    final connectFinder = find.widgetWithText(ElevatedButton, "Connect");
    expect(tester.widget<ElevatedButton>(connectFinder).onPressed, isNull);

    final fields = find.byType(TextField);
    await tester.enterText(fields.at(0), "server.prod.local"); // host
    await tester.enterText(fields.at(2), "root"); // user
    await tester.enterText(fields.at(4), "/var/log/syslog"); // path
    await tester.pump();

    expect(tester.widget<ElevatedButton>(connectFinder).onPressed, isNotNull);

    await tester.tap(connectFinder);
    await tester.pump();

    expect(host, "server.prod.local");
    expect(port, 22);
    expect(user, "root");
    expect(path, "/var/log/syslog");
    expect(tail, isFalse);
  });

  testWidgets("manual tab: pasting logs enables Process Buffer and invokes onIngestManual with trimmed text", (
    tester,
  ) async {
    final container = ProviderContainer();
    addTearDown(container.dispose);
    container.read(ingestionProvider.notifier).setImportOpen(true);

    String? ingestedLogs;

    await tester.pumpWidget(
      _wrap(container, _modal(onIngestManual: (logs) => ingestedLogs = logs)),
    );
    await tester.pump();

    await tester.tap(find.text("Manual"));
    await tester.pump();

    final processFinder = find.widgetWithText(ElevatedButton, "Process Buffer");
    expect(tester.widget<ElevatedButton>(processFinder).onPressed, isNull);

    await tester.enterText(find.byType(TextField), "line one\nline two");
    await tester.pump();

    await tester.tap(processFinder);
    await tester.pump();

    expect(ingestedLogs, "line one\nline two");
  });

  testWidgets("live tab: naming the collection with a protocol selected enables Start Collection", (tester) async {
    final container = ProviderContainer();
    addTearDown(container.dispose);
    container.read(ingestionProvider.notifier).setImportOpen(true);

    String? liveName;
    bool? liveSyslog;
    bool? liveHttp;

    await tester.pumpWidget(
      _wrap(
        container,
        _modal(
          onImportLive: (name, {required syslog, required http}) {
            liveName = name;
            liveSyslog = syslog;
            liveHttp = http;
          },
        ),
      ),
    );
    await tester.pump();

    await tester.tap(find.text("Live"));
    await tester.pump();

    // Both protocols default to enabled (IngestionState defaults), so the
    // "Ready to Ingest" endpoint preview should already be visible.
    expect(find.text("READY TO INGEST"), findsOneWidget);

    final startFinder = find.widgetWithText(ElevatedButton, "Start Collection");
    expect(tester.widget<ElevatedButton>(startFinder).onPressed, isNull);

    await tester.enterText(find.byType(TextField), "Prod Cluster");
    await tester.pump();

    expect(tester.widget<ElevatedButton>(startFinder).onPressed, isNotNull);

    await tester.tap(startFinder);
    await tester.pump();

    expect(liveName, "Prod Cluster");
    expect(liveSyslog, isTrue);
    expect(liveHttp, isTrue);
  });

  testWidgets("live tab: deselecting both protocols disables Start Collection", (tester) async {
    final container = ProviderContainer();
    addTearDown(container.dispose);
    container.read(ingestionProvider.notifier).setImportOpen(true);

    await tester.pumpWidget(_wrap(container, _modal()));
    await tester.pump();

    await tester.tap(find.text("Live"));
    await tester.pump();
    await tester.enterText(find.byType(TextField), "Prod Cluster");
    await tester.pump();

    await tester.tap(find.text("Syslog (UDP)"));
    await tester.pump();
    await tester.tap(find.text("HTTP API"));
    await tester.pump();

    final startFinder = find.widgetWithText(ElevatedButton, "Start Collection");
    expect(tester.widget<ElevatedButton>(startFinder).onPressed, isNull);
  });

  testWidgets("close button closes the modal", (tester) async {
    final container = ProviderContainer();
    addTearDown(container.dispose);
    container.read(ingestionProvider.notifier).setImportOpen(true);

    await tester.pumpWidget(_wrap(container, _modal()));
    await tester.pump();

    await tester.tap(find.byTooltip("Close"));
    await tester.pump();

    expect(container.read(ingestionProvider).isImportOpen, isFalse);
    expect(find.text("Ingest Source"), findsNothing);
  });

  testWidgets("tapping the backdrop closes the modal", (tester) async {
    final container = ProviderContainer();
    addTearDown(container.dispose);
    container.read(ingestionProvider.notifier).setImportOpen(true);

    await tester.pumpWidget(_wrap(container, _modal()));
    await tester.pump();

    // Tap far outside the centered modal card to hit the backdrop.
    await tester.tapAt(const Offset(5, 5));
    await tester.pump();

    expect(container.read(ingestionProvider).isImportOpen, isFalse);
  });
}
