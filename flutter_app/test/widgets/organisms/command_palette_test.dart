import "package:flutter/material.dart";
import "package:flutter/services.dart";
import "package:flutter_riverpod/flutter_riverpod.dart";
import "package:flutter_test/flutter_test.dart";

import "package:loglensai/providers/ai_provider.dart";
import "package:loglensai/providers/ui_provider.dart";
import "package:loglensai/providers/workspace_provider.dart";
import "package:loglensai/services/sidecar_bridge.dart";
import "package:loglensai/theme/app_theme.dart";
import "package:loglensai/widgets/organisms/command_palette.dart";

ProviderContainer _buildContainer() {
  return ProviderContainer(
    overrides: [
      aiProvider.overrideWith((ref) => AiNotifier(SidecarBridge())),
      uiProvider.overrideWith((ref) => UiNotifier()),
      workspaceProvider.overrideWith((ref) => WorkspaceNotifier(SidecarBridge())),
    ],
  );
}

Widget _wrap(ProviderContainer container, Widget child) {
  return UncontrolledProviderScope(
    container: container,
    child: MaterialApp(theme: AppTheme.dark, home: Scaffold(body: child)),
  );
}

void main() {
  testWidgets("renders the search field when open", (tester) async {
    final container = _buildContainer();
    addTearDown(container.dispose);

    await tester.pumpWidget(
      _wrap(
        container,
        CommandPalette(onClose: () {}, onNavSelect: (_) {}),
      ),
    );
    await tester.pump();

    expect(find.text("Type a command or search..."), findsOneWidget);
    expect(find.text("Go to Dashboard"), findsOneWidget);
    expect(find.text("Toggle Main Sidebar"), findsOneWidget);
  });

  testWidgets("typing filters commands by label (case-insensitive)", (tester) async {
    final container = _buildContainer();
    addTearDown(container.dispose);

    await tester.pumpWidget(
      _wrap(container, CommandPalette(onClose: () {}, onNavSelect: (_) {})),
    );
    await tester.enterText(find.byType(TextField), "dashboard");
    await tester.pump();

    expect(find.text("Go to Dashboard"), findsOneWidget);
    expect(find.text("Toggle Main Sidebar"), findsNothing);
  });

  testWidgets("no matches shows the empty message", (tester) async {
    final container = _buildContainer();
    addTearDown(container.dispose);

    await tester.pumpWidget(
      _wrap(container, CommandPalette(onClose: () {}, onNavSelect: (_) {})),
    );
    await tester.enterText(find.byType(TextField), "zzzznomatch");
    await tester.pump();

    expect(find.text("No matching commands found."), findsOneWidget);
  });

  testWidgets("clicking a command activates it and closes the palette", (tester) async {
    final container = _buildContainer();
    addTearDown(container.dispose);

    CommandPaletteNav? selected;
    var closed = false;
    await tester.pumpWidget(
      _wrap(
        container,
        CommandPalette(
          onClose: () => closed = true,
          onNavSelect: (nav) => selected = nav,
        ),
      ),
    );
    await tester.pump();

    await tester.tap(find.text("Go to Dashboard"));
    await tester.pump();

    expect(selected, CommandPaletteNav.dashboard);
    expect(closed, isTrue);
  });

  testWidgets("a bare Enter with no arrow keys activates the first item (React parity)", (
    tester,
  ) async {
    final container = _buildContainer();
    addTearDown(container.dispose);

    CommandPaletteNav? selected;
    await tester.pumpWidget(
      _wrap(
        container,
        CommandPalette(onClose: () {}, onNavSelect: (nav) => selected = nav),
      ),
    );
    await tester.pump();

    await tester.sendKeyEvent(LogicalKeyboardKey.enter);
    await tester.pump();

    expect(selected, CommandPaletteNav.dashboard);
  });

  testWidgets("arrow-down moves the highlight and Enter activates the highlighted item", (
    tester,
  ) async {
    final container = _buildContainer();
    addTearDown(container.dispose);

    CommandPaletteNav? selected;
    await tester.pumpWidget(
      _wrap(
        container,
        CommandPalette(onClose: () {}, onNavSelect: (nav) => selected = nav),
      ),
    );
    await tester.pump();

    // Navigation group: Dashboard(0), Investigation(1), Settings(2).
    await tester.sendKeyEvent(LogicalKeyboardKey.arrowDown);
    await tester.sendKeyEvent(LogicalKeyboardKey.arrowDown);
    await tester.pump();
    await tester.sendKeyEvent(LogicalKeyboardKey.enter);
    await tester.pump();

    expect(selected, CommandPaletteNav.settings);
  });

  testWidgets("arrow-up wraps around to the last item", (tester) async {
    final container = _buildContainer();
    addTearDown(container.dispose);

    CommandPaletteNav? selected;
    var closed = false;
    await tester.pumpWidget(
      _wrap(
        container,
        CommandPalette(
          onClose: () => closed = true,
          onNavSelect: (nav) => selected = nav,
        ),
      ),
    );
    await tester.pump();

    await tester.sendKeyEvent(LogicalKeyboardKey.arrowUp);
    await tester.pump();
    await tester.sendKeyEvent(LogicalKeyboardKey.enter);
    await tester.pump();

    // Wrapping up from index 0 across all 9 commands lands on the last item
    // ("Clear Filters & Search"), which is a no-op onClearFilters -- but the
    // palette should still close, proving activation occurred.
    expect(selected, isNull);
    expect(closed, isTrue);
  });

  testWidgets("Escape closes the palette", (tester) async {
    final container = _buildContainer();
    addTearDown(container.dispose);

    var closed = false;
    await tester.pumpWidget(
      _wrap(container, CommandPalette(onClose: () => closed = true, onNavSelect: (_) {})),
    );
    await tester.pump();

    await tester.sendKeyEvent(LogicalKeyboardKey.escape);
    await tester.pump();

    expect(closed, isTrue);
  });

  testWidgets("Toggle Main Sidebar action flips uiProvider.sidebarCollapsed", (tester) async {
    final container = _buildContainer();
    addTearDown(container.dispose);

    await tester.pumpWidget(
      _wrap(container, CommandPalette(onClose: () {}, onNavSelect: (_) {})),
    );
    await tester.pump();

    expect(container.read(uiProvider).sidebarCollapsed, isFalse);
    await tester.tap(find.text("Toggle Main Sidebar"));
    await tester.pump();

    expect(container.read(uiProvider).sidebarCollapsed, isTrue);
  });
}
