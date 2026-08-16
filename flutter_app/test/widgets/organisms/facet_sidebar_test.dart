import "package:flutter/material.dart";
import "package:flutter_riverpod/flutter_riverpod.dart";
import "package:flutter_test/flutter_test.dart";

import "package:loglensai/providers/investigation_provider.dart";
import "package:loglensai/providers/ui_provider.dart";
import "package:loglensai/theme/app_theme.dart";
import "package:loglensai/widgets/organisms/facet_sidebar.dart";

Widget _wrap(ProviderContainer container, Widget child) {
  return UncontrolledProviderScope(
    container: container,
    child: MaterialApp(theme: AppTheme.dark, home: Scaffold(body: child)),
  );
}

void main() {
  testWidgets("renders no visible content when the sidebar is collapsed", (tester) async {
    final container = ProviderContainer();
    addTearDown(container.dispose);
    container.read(uiProvider.notifier).setFacetSidebarCollapsed(true);

    await tester.pumpWidget(_wrap(container, const FacetSidebar()));
    await tester.pumpAndSettle();

    expect(find.text("LOG FACETS"), findsNothing);
  });

  testWidgets("shows the title and facet values when expanded", (tester) async {
    final container = ProviderContainer();
    addTearDown(container.dispose);
    container.read(uiProvider.notifier).setFacetSidebarCollapsed(false);
    container.read(investigationProvider.notifier).setAvailableFacets({
      "level": const [FacetValue(value: "ERROR", count: 5)],
    });

    await tester.pumpWidget(_wrap(container, const FacetSidebar()));
    await tester.pumpAndSettle();

    expect(find.text("LOG FACETS"), findsOneWidget);
    expect(find.text("ERROR"), findsOneWidget);
  });

  testWidgets("tapping a facet value applies it as an equals filter", (tester) async {
    final container = ProviderContainer();
    addTearDown(container.dispose);
    container.read(uiProvider.notifier).setFacetSidebarCollapsed(false);
    container.read(investigationProvider.notifier).setAvailableFacets({
      "level": const [FacetValue(value: "ERROR", count: 5)],
    });

    await tester.pumpWidget(_wrap(container, const FacetSidebar()));
    await tester.pumpAndSettle();

    await tester.tap(find.text("ERROR"));
    await tester.pump();

    final filters = container.read(investigationProvider).filters;
    expect(filters, hasLength(1));
    expect(filters.single["field"], "level");
    expect(filters.single["value"], "ERROR");
    expect(filters.single["operator"], "equals");
  });

  testWidgets("tapping an already-active facet value removes the filter", (tester) async {
    final container = ProviderContainer();
    addTearDown(container.dispose);
    container.read(uiProvider.notifier).setFacetSidebarCollapsed(false);
    container.read(investigationProvider.notifier).setAvailableFacets({
      "level": const [FacetValue(value: "ERROR", count: 5)],
    });
    container.read(investigationProvider.notifier).setFilters([
      {"field": "level", "value": "ERROR", "operator": "equals"},
    ]);

    await tester.pumpWidget(_wrap(container, const FacetSidebar()));
    await tester.pumpAndSettle();

    await tester.tap(find.text("ERROR"));
    await tester.pump();

    expect(container.read(investigationProvider).filters, isEmpty);
  });

  testWidgets("clear-filters button only clears facet/level filters, leaving others intact", (tester) async {
    final container = ProviderContainer();
    addTearDown(container.dispose);
    container.read(uiProvider.notifier).setFacetSidebarCollapsed(false);
    container.read(investigationProvider.notifier).setFilters([
      {"field": "level", "value": "ERROR", "operator": "equals"},
      {"field": "message", "value": "timeout", "operator": "contains"},
    ]);

    await tester.pumpWidget(_wrap(container, const FacetSidebar()));
    await tester.pumpAndSettle();

    expect(find.byTooltip("Clear Facet Filters"), findsOneWidget);
    await tester.tap(find.byTooltip("Clear Facet Filters"));
    await tester.pump();

    final filters = container.read(investigationProvider).filters;
    expect(filters, hasLength(1));
    expect(filters.single["field"], "message");
  });

  testWidgets("collapse button toggles uiProvider.facetSidebarCollapsed", (tester) async {
    final container = ProviderContainer();
    addTearDown(container.dispose);
    container.read(uiProvider.notifier).setFacetSidebarCollapsed(false);

    await tester.pumpWidget(_wrap(container, const FacetSidebar()));
    await tester.pumpAndSettle();

    expect(container.read(uiProvider).facetSidebarCollapsed, isFalse);
    await tester.tap(find.byTooltip("Collapse Facets"));
    await tester.pump();

    expect(container.read(uiProvider).facetSidebarCollapsed, isTrue);
  });
}
