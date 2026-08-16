/// Dart port of `src/components/organisms/FacetSidebar.tsx`.
///
/// 256px collapsible left panel wrapping the `FacetList` molecule with
/// header chrome: a "Log Facets" title, a "clear facet filters" action
/// (visible only when a `facets.*`/`level` filter is active), and a
/// collapse toggle. Reads/writes [uiProvider] (collapse state) and
/// [investigationProvider] (active filters + available facets) directly,
/// mirroring the React version's direct `useUIStore`/`useInvestigationStore`
/// access -- there's no dedicated "facet sidebar" store to wire through, and
/// both providers already carry everything this organism needs.
///
/// Deviation: the React version animates width/opacity with `framer-motion`
/// (spring physics). This port uses a plain [AnimatedContainer] width tween
/// (curve-based, not spring) for the same collapse/expand effect --
/// functionally equivalent, just without spring overshoot.
library;

import "package:flutter/material.dart";
import "package:flutter_riverpod/flutter_riverpod.dart";

import "../../providers/investigation_provider.dart";
import "../../providers/ui_provider.dart";
import "../../theme/app_theme.dart";
import "../molecules/facet_list.dart" as facet_list;

const double _kFacetSidebarWidth = 256;

class FacetSidebar extends ConsumerWidget {
  const FacetSidebar({super.key});

  static const String _levelField = "level";
  static const String _facetPrefix = "facets.";

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final collapsed = ref.watch(uiProvider.select((s) => s.facetSidebarCollapsed));
    final filters = ref.watch(investigationProvider.select((s) => s.filters));
    final availableFacets = ref.watch(investigationProvider.select((s) => s.availableFacets));

    final hasFacetFilters = filters.any((f) {
      final field = f["field"] as String? ?? "";
      return field.startsWith(_facetPrefix) || field == _levelField;
    });

    final activeValues = <String>{
      for (final f in filters)
        if (f["field"] != null && f["value"] != null)
          "${_keyForField(f["field"] as String)}::${f["value"]}",
    };

    final facetsForList = <String, List<facet_list.FacetValue>>{
      for (final entry in availableFacets.entries)
        entry.key: entry.value
            .map((v) => facet_list.FacetValue(value: v.value, count: v.count))
            .toList(),
    };

    void clearFacetFilters() {
      ref.read(investigationProvider.notifier).setFilters(
        filters.where((f) {
          final field = f["field"] as String? ?? "";
          return !field.startsWith(_facetPrefix) && field != _levelField;
        }).toList(),
      );
    }

    void applyFilter(String key, String value) {
      final field = key == _levelField ? _levelField : "$_facetPrefix$key";
      final idx = filters.indexWhere((f) => f["field"] == field && f["value"] == value);
      final notifier = ref.read(investigationProvider.notifier);
      if (idx != -1) {
        final next = [...filters]..removeAt(idx);
        notifier.setFilters(next);
      } else {
        notifier.setFilters([
          ...filters,
          {"field": field, "value": value, "operator": "equals"},
        ]);
      }
    }

    return ClipRect(
      child: AnimatedContainer(
        duration: const Duration(milliseconds: 220),
        curve: Curves.easeOutCubic,
        width: collapsed ? 0 : _kFacetSidebarWidth,
        decoration: const BoxDecoration(
          color: AppColors.bgApp,
          border: Border(right: BorderSide(color: AppColors.borderSubtle)),
        ),
        child: collapsed
            ? null
            : SizedBox(
                width: _kFacetSidebarWidth,
                child: Column(
                  children: [
                    SizedBox(
                      height: 48,
                      child: Padding(
                        padding: const EdgeInsets.symmetric(horizontal: AppSpacing.md),
                        child: Row(
                          children: [
                            Expanded(
                              child: Text(
                                "LOG FACETS",
                                style: AppTypography.labelCaps,
                                overflow: TextOverflow.ellipsis,
                              ),
                            ),
                            if (hasFacetFilters)
                              IconButton(
                                tooltip: "Clear Facet Filters",
                                icon: const Icon(Icons.filter_alt_off, size: 16),
                                color: AppColors.textMuted,
                                onPressed: clearFacetFilters,
                              ),
                            IconButton(
                              tooltip: "Collapse Facets",
                              icon: const Icon(Icons.chevron_left, size: 18),
                              color: AppColors.textMuted,
                              onPressed: () =>
                                  ref.read(uiProvider.notifier).toggleFacetSidebar(),
                            ),
                          ],
                        ),
                      ),
                    ),
                    const Divider(height: 1, color: AppColors.borderSubtle),
                    Expanded(
                      child: SingleChildScrollView(
                        child: facet_list.FacetList(
                          availableFacets: facetsForList,
                          activeValues: activeValues,
                          onApplyFilter: applyFilter,
                        ),
                      ),
                    ),
                  ],
                ),
              ),
      ),
    );
  }

  static String _keyForField(String field) =>
      field.startsWith(_facetPrefix) ? field.substring(_facetPrefix.length) : field;
}
