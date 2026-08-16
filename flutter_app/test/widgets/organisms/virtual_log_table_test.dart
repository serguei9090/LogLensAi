import "package:flutter/material.dart";
import "package:flutter/services.dart";
import "package:flutter_riverpod/flutter_riverpod.dart";
import "package:flutter_test/flutter_test.dart";

import "package:loglensai/models/log_entry.dart";
import "package:loglensai/providers/investigation_provider.dart";
import "package:loglensai/theme/app_theme.dart";
import "package:loglensai/widgets/organisms/virtual_log_table.dart";

LogEntry _log({
  required int id,
  int? lineId,
  String timestamp = "2026-01-01T00:00:00Z",
  String level = "INFO",
  String message = "sample message",
  String clusterId = "",
  String sourceId = "src1",
}) {
  return LogEntry(
    id: id,
    lineId: lineId ?? id,
    timestamp: timestamp,
    level: level,
    message: message,
    clusterId: clusterId,
    sourceId: sourceId,
  );
}

ProviderContainer _buildContainer() => ProviderContainer();

Widget _wrap(
  ProviderContainer container,
  Widget child, {
  double width = 900,
  double height = 500,
}) {
  return UncontrolledProviderScope(
    container: container,
    child: MaterialApp(
      theme: AppTheme.dark,
      home: Scaffold(body: SizedBox(width: width, height: height, child: child)),
    ),
  );
}

/// Pulls every plain-text string a [Text] widget renders, whether via
/// `Text(data)` or `Text.rich(TextSpan(...))` (used for highlighted
/// messages) -- `find.text` only matches the former.
List<String> _allRenderedText(WidgetTester tester) {
  return tester
      .widgetList<Text>(find.byType(Text))
      .map((t) => t.data ?? t.textSpan?.toPlainText() ?? "")
      .toList();
}

void main() {
  group("VirtualLogTable", () {
    testWidgets("renders row cells with correct data", (tester) async {
      final container = _buildContainer();
      addTearDown(container.dispose);

      final logs = [
        _log(
          id: 1,
          lineId: 0,
          timestamp: "2026-01-01T00:00:00Z",
          level: "ERROR",
          message: "boom",
          clusterId: "42",
        ),
        _log(id: 2, lineId: 1, timestamp: "2026-01-01T00:01:00Z", level: "INFO", message: "ok"),
      ];

      await tester.pumpWidget(
        _wrap(
          container,
          VirtualLogTable(
            logs: logs,
            onAddComment: (_, _) {},
            onSort: (_) {},
            sortBy: "timestamp",
            sortOrder: "desc",
          ),
        ),
      );
      await tester.pump();

      // ID column shows line_id + 1.
      expect(find.text("1"), findsOneWidget);
      expect(find.text("2"), findsOneWidget);
      // Timestamp column shows the raw string verbatim.
      expect(find.text("2026-01-01T00:00:00Z"), findsOneWidget);
      expect(find.text("2026-01-01T00:01:00Z"), findsOneWidget);
      // Level badges.
      expect(find.text("ERROR"), findsOneWidget);
      expect(find.text("INFO"), findsOneWidget);
      // Cluster pill.
      expect(find.text("#42"), findsOneWidget);

      final rendered = _allRenderedText(tester);
      expect(rendered, contains("boom"));
      expect(rendered, contains("ok"));
    });

    testWidgets("tapping a sortable header column fires onSort with its column id", (
      tester,
    ) async {
      final container = _buildContainer();
      addTearDown(container.dispose);

      final calls = <String>[];
      await tester.pumpWidget(
        _wrap(
          container,
          VirtualLogTable(
            logs: [_log(id: 1)],
            onAddComment: (_, _) {},
            onSort: calls.add,
            sortBy: "timestamp",
            sortOrder: "desc",
          ),
        ),
      );
      await tester.pump();

      await tester.tap(find.text("ID"));
      await tester.pump();

      expect(calls, ["id"]);

      await tester.tap(find.text("TIMESTAMP"));
      await tester.pump();

      expect(calls, ["id", "timestamp"]);
    });

    testWidgets("a plain click selects only the clicked row", (tester) async {
      final container = _buildContainer();
      addTearDown(container.dispose);

      final logs = List.generate(5, (i) => _log(id: i + 1, lineId: i));
      await tester.pumpWidget(
        _wrap(
          container,
          VirtualLogTable(
            logs: logs,
            onAddComment: (_, _) {},
            onSort: (_) {},
            sortBy: "timestamp",
            sortOrder: "desc",
          ),
        ),
      );
      await tester.pump();

      await tester.tap(find.text("3"));
      await tester.pump();
      expect(container.read(investigationProvider).selectedLogIds, [3]);

      // A second plain click replaces the selection rather than adding to it.
      await tester.tap(find.text("5"));
      await tester.pump();
      expect(container.read(investigationProvider).selectedLogIds, [5]);
    });

    testWidgets("ctrl-click toggles additive selection", (tester) async {
      final container = _buildContainer();
      addTearDown(container.dispose);

      final logs = List.generate(5, (i) => _log(id: i + 1, lineId: i));
      await tester.pumpWidget(
        _wrap(
          container,
          VirtualLogTable(
            logs: logs,
            onAddComment: (_, _) {},
            onSort: (_) {},
            sortBy: "timestamp",
            sortOrder: "desc",
          ),
        ),
      );
      await tester.pump();

      await tester.tap(find.text("1"));
      await tester.pump();
      expect(container.read(investigationProvider).selectedLogIds, [1]);

      await tester.sendKeyDownEvent(LogicalKeyboardKey.controlLeft);
      await tester.tap(find.text("3"));
      await tester.pump();
      await tester.sendKeyUpEvent(LogicalKeyboardKey.controlLeft);

      expect(container.read(investigationProvider).selectedLogIds, containsAll([1, 3]));
      expect(container.read(investigationProvider).selectedLogIds, hasLength(2));

      // Ctrl-clicking an already-selected row removes it (toggle).
      await tester.sendKeyDownEvent(LogicalKeyboardKey.controlLeft);
      await tester.tap(find.text("1"));
      await tester.pump();
      await tester.sendKeyUpEvent(LogicalKeyboardKey.controlLeft);

      expect(container.read(investigationProvider).selectedLogIds, [3]);
    });

    testWidgets("shift-click selects a contiguous range", (tester) async {
      final container = _buildContainer();
      addTearDown(container.dispose);

      final logs = List.generate(5, (i) => _log(id: i + 1, lineId: i));
      await tester.pumpWidget(
        _wrap(
          container,
          VirtualLogTable(
            logs: logs,
            onAddComment: (_, _) {},
            onSort: (_) {},
            sortBy: "timestamp",
            sortOrder: "desc",
          ),
        ),
      );
      await tester.pump();

      await tester.tap(find.text("1"));
      await tester.pump();

      await tester.sendKeyDownEvent(LogicalKeyboardKey.shiftLeft);
      await tester.tap(find.text("4"));
      await tester.pump();
      await tester.sendKeyUpEvent(LogicalKeyboardKey.shiftLeft);

      expect(container.read(investigationProvider).selectedLogIds, [1, 2, 3, 4]);
    });

    testWidgets("tapping the note icon expands the detail panel; close collapses it", (
      tester,
    ) async {
      final container = _buildContainer();
      addTearDown(container.dispose);

      final logs = [_log(id: 1, lineId: 0, message: "raw payload here")];
      await tester.pumpWidget(
        _wrap(
          container,
          VirtualLogTable(
            logs: logs,
            onAddComment: (_, _) {},
            onSort: (_) {},
            sortBy: "timestamp",
            sortOrder: "desc",
          ),
        ),
      );
      await tester.pump();

      expect(find.text("RAW MESSAGE"), findsNothing);

      await tester.tap(find.byTooltip("Add note"));
      await tester.pump();

      expect(find.text("RAW MESSAGE"), findsOneWidget);
      expect(find.text("Log Entry #1"), findsOneWidget);
      expect(_allRenderedText(tester), contains("raw payload here"));

      await tester.tap(find.byTooltip("Close"));
      await tester.pump();

      expect(find.text("RAW MESSAGE"), findsNothing);
    });

    testWidgets("saving a note in the detail panel calls onAddComment", (tester) async {
      final container = _buildContainer();
      addTearDown(container.dispose);

      int? savedId;
      String? savedComment;
      final logs = [_log(id: 7, lineId: 6)];
      await tester.pumpWidget(
        _wrap(
          container,
          VirtualLogTable(
            logs: logs,
            onAddComment: (id, comment) {
              savedId = id;
              savedComment = comment;
            },
            onSort: (_) {},
            sortBy: "timestamp",
            sortOrder: "desc",
          ),
        ),
      );
      await tester.pump();

      await tester.tap(find.byTooltip("Add note"));
      await tester.pump();

      await tester.enterText(find.byType(TextField), "root cause found");
      await tester.tap(find.text("Save note"));
      await tester.pump();

      expect(savedId, 7);
      expect(savedComment, "root cause found");
    });

    testWidgets("scrolling near the bottom triggers fetchMoreLogs", (tester) async {
      final container = _buildContainer();
      addTearDown(container.dispose);

      final logs = List.generate(50, (i) => _log(id: i + 1, lineId: i));
      var fetchCalls = 0;

      await tester.pumpWidget(
        _wrap(
          container,
          VirtualLogTable(
            logs: logs,
            onAddComment: (_, _) {},
            onSort: (_) {},
            sortBy: "timestamp",
            sortOrder: "desc",
            total: 1000,
            fetchMoreLogs: () => fetchCalls++,
          ),
          height: 300,
        ),
      );
      await tester.pump();
      await tester.pump();

      // Content (50 rows * 40px = 2000px) far exceeds the 300px viewport, so
      // simply mounting near the top must not have triggered a fetch yet.
      expect(fetchCalls, 0);

      // `total` (1000) exceeds `logs.length` here, so `hasMore` is true and
      // the loader row's `CircularProgressIndicator` animates forever --
      // `pumpAndSettle` would never converge, so drive the scroll ballistics
      // with bounded `pump`s instead.
      await tester.fling(find.byType(ListView), const Offset(0, -20000), 4000);
      await tester.pump();
      await tester.pump(const Duration(milliseconds: 500));
      await tester.pump(const Duration(milliseconds: 500));
      await tester.pump(const Duration(milliseconds: 500));

      expect(fetchCalls, greaterThan(0));
    });

    testWidgets(
      "virtualization: 10,000 logs only materialize a bounded number of row widgets",
      (tester) async {
        final container = _buildContainer();
        addTearDown(container.dispose);

        final logs = List.generate(10000, (i) => _log(id: i + 1, lineId: i, message: "line $i"));

        await tester.pumpWidget(
          _wrap(
            container,
            VirtualLogTable(
              logs: logs,
              onAddComment: (_, _) {},
              onSort: (_) {},
              sortBy: "timestamp",
              sortOrder: "desc",
            ),
            height: 600,
          ),
        );
        await tester.pump();

        // Every row Container is keyed with the log's id (`ValueKey<int>`)
        // -- nothing else in this widget's tree uses an int-keyed widget, so
        // counting matches of that key shape is a direct measurement of how
        // many row widgets ListView.builder actually materialized.
        final rowFinder = find.byWidgetPredicate((w) => w.key is ValueKey<int>);
        final materializedCount = tester.widgetList(rowFinder).length;

        // A ~560px content area at 40px/row is ~14 visible rows; with
        // ListView's default ~250px cache extent on each side that's at most
        // a few dozen materialized widgets -- nowhere near the 10,000 given.
        expect(materializedCount, greaterThan(0));
        expect(materializedCount, lessThan(100));

        // Scrolling deep into the list must not balloon the materialized
        // count either -- virtualization has to hold at every scroll offset,
        // not just at the top.
        await tester.fling(find.byType(ListView), const Offset(0, -100000), 8000);
        await tester.pump();
        await tester.pump(const Duration(milliseconds: 500));
        await tester.pump(const Duration(milliseconds: 500));

        final materializedAfterScroll = tester.widgetList(rowFinder).length;
        expect(materializedAfterScroll, greaterThan(0));
        expect(materializedAfterScroll, lessThan(100));
      },
    );

    testWidgets("empty logs with no active job shows the empty state and Import button", (
      tester,
    ) async {
      final container = _buildContainer();
      addTearDown(container.dispose);

      var importTapped = false;
      await tester.pumpWidget(
        _wrap(
          container,
          VirtualLogTable(
            logs: const [],
            onAddComment: (_, _) {},
            onSort: (_) {},
            sortBy: "timestamp",
            sortOrder: "desc",
            onImport: () => importTapped = true,
          ),
        ),
      );
      await tester.pump();

      expect(find.text("No logs detected"), findsOneWidget);

      await tester.tap(find.text("Import First Log"));
      await tester.pump();

      expect(importTapped, isTrue);
    });
  });
}
