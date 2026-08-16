import "package:flutter/material.dart";
import "package:flutter_riverpod/flutter_riverpod.dart";
import "package:flutter_test/flutter_test.dart";

import "package:loglensai/providers/ai_provider.dart";
import "package:loglensai/theme/app_theme.dart";
import "package:loglensai/widgets/organisms/log_toolbar.dart";

Widget _wrap(ProviderContainer container, Widget child) {
  return UncontrolledProviderScope(
    container: container,
    child: MaterialApp(theme: AppTheme.dark, home: Scaffold(body: child)),
  );
}

void main() {
  // LogToolbar's full active-source row (import/export/orchestrate, facet
  // and column-manager icons, tail switch, search bar, time-range picker,
  // filter/highlight builders, columns/template menus, AI toggle) is wider
  // than the default 800px test surface. Widen it, mirroring
  // `custom_parser_modal_test.dart`'s surface-resize setup.
  setUp(() {
    final binding = TestWidgetsFlutterBinding.ensureInitialized();
    binding.platformDispatcher.views.first.physicalSize = const Size(1600, 800);
    binding.platformDispatcher.views.first.devicePixelRatio = 1.0;
  });
  tearDown(() {
    final binding = TestWidgetsFlutterBinding.ensureInitialized();
    binding.platformDispatcher.views.first.resetPhysicalSize();
    binding.platformDispatcher.views.first.resetDevicePixelRatio();
  });

  testWidgets("renders the import button and status dot without an active source", (tester) async {
    final container = ProviderContainer();
    addTearDown(container.dispose);
    var importTapped = false;

    await tester.pumpWidget(
      _wrap(
        container,
        LogToolbar(
          searchQuery: "",
          onSearch: (_) {},
          activeFilters: const [],
          onFilterChange: (_) {},
          activeHighlights: const [],
          onHighlightChange: (_) {},
          isTailing: false,
          onTailToggle: (_) {},
          status: true,
          onImportOpen: () => importTapped = true,
          onOrchestrateOpen: () {},
          onExport: () {},
        ),
      ),
    );

    expect(find.text("Import"), findsOneWidget);
    // No active source -> the search bar / export / orchestrate row is not shown.
    expect(find.text("Export"), findsNothing);
    expect(find.text("Orchestrate"), findsNothing);

    await tester.tap(find.text("Import"));
    expect(importTapped, isTrue);
  });

  testWidgets("with an active source, shows export/orchestrate/search and forwards taps", (tester) async {
    final container = ProviderContainer();
    addTearDown(container.dispose);
    var orchestrateTapped = false;
    var exportTapped = false;
    var tailToggled = false;
    String? lastSearch;

    await tester.pumpWidget(
      _wrap(
        container,
        LogToolbar(
          searchQuery: "err",
          onSearch: (v) => lastSearch = v,
          activeFilters: const [],
          onFilterChange: (_) {},
          activeHighlights: const [],
          onHighlightChange: (_) {},
          isTailing: false,
          onTailToggle: (_) => tailToggled = true,
          status: true,
          onImportOpen: () {},
          onOrchestrateOpen: () => orchestrateTapped = true,
          onExport: () => exportTapped = true,
          activeSourceId: "s1",
        ),
      ),
    );

    expect(find.text("Export"), findsOneWidget);
    expect(find.text("Orchestrate"), findsOneWidget);

    await tester.tap(find.text("Export"));
    expect(exportTapped, isTrue);

    await tester.tap(find.text("Orchestrate"));
    expect(orchestrateTapped, isTrue);

    await tester.enterText(find.byType(TextField).first, "boom");
    // LogSearchBar debounces onChange by 300ms.
    await tester.pump(const Duration(milliseconds: 350));
    expect(lastSearch, "boom");

    await tester.tap(find.text("Tail"));
    expect(tailToggled, isTrue);
  });

  testWidgets("the AI assistant toggle flips aiProvider.isSidebarOpen", (tester) async {
    final container = ProviderContainer();
    addTearDown(container.dispose);

    await tester.pumpWidget(
      _wrap(
        container,
        LogToolbar(
          searchQuery: "",
          onSearch: (_) {},
          activeFilters: const [],
          onFilterChange: (_) {},
          activeHighlights: const [],
          onHighlightChange: (_) {},
          isTailing: false,
          onTailToggle: (_) {},
          status: true,
          onImportOpen: () {},
          onOrchestrateOpen: () {},
          onExport: () {},
          activeSourceId: "s1",
        ),
      ),
    );

    expect(container.read(aiProvider).isSidebarOpen, isFalse);

    await tester.tap(find.byTooltip("Open AI Assistant"));
    await tester.pump();

    expect(container.read(aiProvider).isSidebarOpen, isTrue);
  });
}
