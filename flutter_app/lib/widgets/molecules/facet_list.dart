/// Dart port of `src/components/molecules/FacetList.tsx`.
///
/// Collapsible list of extracted metadata facets (grouped by facet key,
/// e.g. `ip`, `uuid`, `level`) with per-value hit counts; tapping a value
/// applies/toggles a filter. The React version reads/writes
/// `useInvestigationStore` directly; this widget instead takes
/// [availableFacets] + [activeFilters] as props and reports taps via
/// [onApplyFilter], keeping it presentation-only -- the caller (backed by
/// `investigation_provider.dart`) owns the actual filter-toggle logic and
/// ID field mapping (`level` vs `facets.<key>`).
library;

import "package:flutter/material.dart";

import "../../theme/app_theme.dart";

class FacetValue {
  const FacetValue({required this.value, required this.count});
  final String value;
  final int count;
}

class FacetList extends StatefulWidget {
  const FacetList({
    super.key,
    required this.availableFacets,
    this.activeValues = const {},
    this.onApplyFilter,
    this.initiallyExpandedKeys = const {"ip", "uuid", "level", "email", "user_id"},
  });

  /// Facet key -> list of distinct values + counts (mirrors the TS
  /// `Record<string, {value, count}[]>` shape of `availableFacets`).
  final Map<String, List<FacetValue>> availableFacets;

  /// Set of `"<key>::<value>"` pairs currently active as filters, used to
  /// highlight the matching row. Caller-computed so this widget doesn't
  /// need to know about `LogFilter`'s field-name mapping (`level` vs
  /// `facets.<key>`).
  final Set<String> activeValues;

  /// Fired with `(key, value)` when a facet value row is tapped.
  final void Function(String key, String value)? onApplyFilter;

  final Set<String> initiallyExpandedKeys;

  @override
  State<FacetList> createState() => _FacetListState();
}

class _FacetListState extends State<FacetList> {
  late final Set<String> _expandedKeys = {...widget.initiallyExpandedKeys};

  void _toggleKey(String key) {
    setState(() {
      if (_expandedKeys.contains(key)) {
        _expandedKeys.remove(key);
      } else {
        _expandedKeys.add(key);
      }
    });
  }

  @override
  Widget build(BuildContext context) {
    if (widget.availableFacets.isEmpty) {
      return Padding(
        padding: const EdgeInsets.symmetric(horizontal: AppSpacing.lg, vertical: 40),
        child: Column(
          children: [
            Icon(Icons.storage_outlined, size: 32, color: AppColors.textMuted.withValues(alpha: 0.4)),
            const SizedBox(height: AppSpacing.sm),
            Text(
              "No metadata facets detected in current view.",
              textAlign: TextAlign.center,
              style: AppTypography.body.copyWith(fontSize: 11, color: AppColors.textMuted),
            ),
          ],
        ),
      );
    }

    return Padding(
      padding: const EdgeInsets.symmetric(vertical: AppSpacing.xs),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: widget.availableFacets.entries.map((entry) {
          final key = entry.key;
          final values = entry.value;
          final expanded = _expandedKeys.contains(key);
          return Padding(
            padding: const EdgeInsets.symmetric(horizontal: AppSpacing.xs),
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Material(
                  color: Colors.transparent,
                  child: InkWell(
                    onTap: () => _toggleKey(key),
                    borderRadius: BorderRadius.circular(AppRadius.sm),
                    child: Padding(
                      padding: const EdgeInsets.symmetric(horizontal: AppSpacing.xs, vertical: 6),
                      child: Row(
                        children: [
                          Icon(
                            expanded ? Icons.expand_more : Icons.chevron_right,
                            size: 14,
                            color: AppColors.textMuted,
                          ),
                          const SizedBox(width: AppSpacing.xs),
                          Expanded(
                            child: Text(
                              key,
                              style: AppTypography.body.copyWith(
                                fontSize: 12,
                                fontWeight: FontWeight.w500,
                                color: AppColors.textSecondary,
                              ),
                            ),
                          ),
                          Text(
                            "${values.length}",
                            style: AppTypography.body.copyWith(fontSize: 10, color: AppColors.textMuted),
                          ),
                        ],
                      ),
                    ),
                  ),
                ),
                if (expanded)
                  Padding(
                    padding: const EdgeInsets.only(left: AppSpacing.lg, right: AppSpacing.xs),
                    child: Column(
                      children: values.map((v) {
                        final isActive = widget.activeValues.contains("$key::${v.value}");
                        return Material(
                          color: isActive ? AppColors.primary.withValues(alpha: 0.1) : Colors.transparent,
                          borderRadius: BorderRadius.circular(AppRadius.sm),
                          child: InkWell(
                            onTap: () => widget.onApplyFilter?.call(key, v.value),
                            borderRadius: BorderRadius.circular(AppRadius.sm),
                            child: Padding(
                              padding: const EdgeInsets.symmetric(horizontal: AppSpacing.xs, vertical: 4),
                              child: Row(
                                children: [
                                  Expanded(
                                    child: Text(
                                      v.value,
                                      maxLines: 1,
                                      overflow: TextOverflow.ellipsis,
                                      style: AppTypography.log.copyWith(
                                        fontSize: 11,
                                        color: isActive ? AppColors.primary : AppColors.textMuted,
                                      ),
                                    ),
                                  ),
                                  Text(
                                    "${v.count}",
                                    style: TextStyle(
                                      fontSize: 9,
                                      color: (isActive ? AppColors.primary : AppColors.textMuted)
                                          .withValues(alpha: 0.6),
                                    ),
                                  ),
                                ],
                              ),
                            ),
                          ),
                        );
                      }).toList(),
                    ),
                  ),
              ],
            ),
          );
        }).toList(),
      ),
    );
  }
}
