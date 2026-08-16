import "package:flutter/material.dart";
import "package:flutter_riverpod/flutter_riverpod.dart";
import "package:flutter_test/flutter_test.dart";

import "package:loglensai/models/ui_column.dart";
import "package:loglensai/providers/ui_provider.dart";
import "package:loglensai/providers/workspace_provider.dart";
import "package:loglensai/services/sidecar_bridge.dart";
import "package:loglensai/theme/app_theme.dart";
import "package:loglensai/widgets/organisms/column_manager_sidebar.dart";

/// [UiNotifier] pre-expanded (`columnManagerCollapsed: false`) so the panel
/// is interactive/hit-testable in tests -- the real default is collapsed.
UiNotifier _expandedNotifier({List<CustomColumnDef>? customColumns, List<String>? columnOrder}) {
  final notifier = UiNotifier();
  notifier.toggleColumnManager();
  if (customColumns != null) {
    for (final c in customColumns) {
      notifier.addCustomColumn(c);
    }
  }
  if (columnOrder != null) {
    notifier.setColumnOrder(columnOrder);
  }
  return notifier;
}

ProviderContainer _buildContainer({UiNotifier? uiNotifier}) {
  return ProviderContainer(
    overrides: [
      uiProvider.overrideWith((ref) => uiNotifier ?? _expandedNotifier()),
      workspaceProvider.overrideWith((ref) => WorkspaceNotifier(SidecarBridge())),
    ],
  );
}

Widget _wrap(ProviderContainer container) {
  return UncontrolledProviderScope(
    container: container,
    child: MaterialApp(
      theme: AppTheme.dark,
      home: const Scaffold(body: ColumnManagerSidebar()),
    ),
  );
}

void main() {
  testWidgets("renders header and built-in column rows with badges", (tester) async {
    final container = _buildContainer();
    addTearDown(container.dispose);

    await tester.pumpWidget(_wrap(container));
    await tester.pump();

    expect(find.text("COLUMNS"), findsOneWidget);
    expect(find.text("Timestamp"), findsOneWidget);
    expect(find.text("Message"), findsOneWidget);
    expect(find.text("BUILT-IN"), findsWidgets);
    expect(find.text("AUTO"), findsWidgets); // http_method / http_status defaults
  });

  testWidgets("collapsed by default (zero width) per UiState default", (tester) async {
    final container = _buildContainer(uiNotifier: UiNotifier());
    addTearDown(container.dispose);

    await tester.pumpWidget(_wrap(container));
    await tester.pump();

    final animatedContainer = tester.widget<AnimatedContainer>(find.byType(AnimatedContainer));
    expect(animatedContainer.constraints?.maxWidth ?? 0, 0);
  });

  testWidgets("tapping a row toggles column visibility", (tester) async {
    final container = _buildContainer();
    addTearDown(container.dispose);

    await tester.pumpWidget(_wrap(container));
    await tester.pump();

    expect(container.read(uiProvider).visibleColumns["timestamp"], isTrue);

    await tester.tap(find.text("Timestamp"));
    await tester.pump();

    expect(container.read(uiProvider).visibleColumns["timestamp"], isFalse);
  });

  testWidgets("user-sourced custom columns show a delete button that removes them", (
    tester,
  ) async {
    const custom = CustomColumnDef(
      id: "custom1",
      label: "Custom Field",
      width: "100px",
      source: "user",
      regex: r"foo=(\d+)",
    );
    final container = _buildContainer(uiNotifier: _expandedNotifier(customColumns: [custom]));
    addTearDown(container.dispose);

    await tester.pumpWidget(_wrap(container));
    await tester.pump();

    expect(find.text("Custom Field"), findsOneWidget);
    expect(find.text("REGEX"), findsOneWidget);

    await tester.tap(find.widgetWithIcon(IconButton, Icons.close));
    await tester.pump();

    expect(container.read(uiProvider).columnOrder.contains("custom1"), isFalse);
    expect(find.text("Custom Field"), findsNothing);
  });

  testWidgets("built-in / auto columns have no delete button", (tester) async {
    final container = _buildContainer();
    addTearDown(container.dispose);

    await tester.pumpWidget(_wrap(container));
    await tester.pump();

    expect(find.widgetWithIcon(IconButton, Icons.close), findsNothing);
  });

  testWidgets("dragging a row by its handle reorders the column order", (tester) async {
    final container = _buildContainer(
      uiNotifier: _expandedNotifier(
        columnOrder: const ["id", "timestamp", "level", "message"],
      ),
    );
    addTearDown(container.dispose);

    await tester.pumpWidget(_wrap(container));
    await tester.pump();

    expect(container.read(uiProvider).columnOrder, ["id", "timestamp", "level", "message"]);

    final handles = find.byIcon(Icons.drag_indicator);
    expect(handles, findsNWidgets(4));

    final firstHandle = tester.getCenter(handles.first);
    final gesture = await tester.startGesture(firstHandle);
    await tester.pump(const Duration(milliseconds: 100));
    // Move in a few steps well past the later rows so "id" clearly changes
    // position (exact landing index isn't asserted, just that it moved).
    for (var i = 0; i < 4; i++) {
      await gesture.moveBy(const Offset(0, 50));
      await tester.pump(const Duration(milliseconds: 50));
    }
    await gesture.up();
    await tester.pumpAndSettle();

    final order = container.read(uiProvider).columnOrder;
    expect(order.first, isNot("id"));
    expect(order.contains("id"), isTrue);
    expect(order.toSet(), {"id", "timestamp", "level", "message"});
  });

  testWidgets("Add Column opens AddColumnModal", (tester) async {
    final container = _buildContainer();
    addTearDown(container.dispose);

    await tester.pumpWidget(_wrap(container));
    await tester.pump();

    await tester.tap(find.text("Add Column"));
    await tester.pumpAndSettle();

    expect(find.text("Add Custom Column"), findsOneWidget);
  });

  testWidgets("close button collapses the panel", (tester) async {
    final container = _buildContainer();
    addTearDown(container.dispose);

    await tester.pumpWidget(_wrap(container));
    await tester.pump();

    expect(container.read(uiProvider).columnManagerCollapsed, isFalse);

    await tester.tap(find.byIcon(Icons.keyboard_double_arrow_left));
    await tester.pump();

    expect(container.read(uiProvider).columnManagerCollapsed, isTrue);
  });
}
