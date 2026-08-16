/// Dart port of `src/components/molecules/FilterBuilder.tsx`.
///
/// Chip-based structured filter editor: a trigger chip that expands an
/// inline panel to pick a field + operator + value and add it to the
/// active [LogFilter] list, plus a reorderable list of active filter chips.
///
/// Two deliberate deviations from the React source:
///  - The React version's field/operator/value editor lives in a floating
///    Radix `Popover`. This port renders it as an inline panel that
///    expands directly below the trigger chip instead of a real overlay --
///    simpler to lay out without a `Positioned`/`Overlay` dance and
///    directly `tester.tap`-able in widget tests, at the cost of pushing
///    surrounding content down instead of floating over it.
///  - `LogFilter` (`lib/models/log_entry.dart`) has no `id` field (unlike
///    the React `FilterEntry`), so active filters are removed/reordered by
///    list index instead of a generated UUID -- there's no `uuid`/
///    `crypto.randomUUID` equivalent wired into this project yet, and
///    index-based identity is sufficient for a flat, caller-owned list.
library;

import "package:flutter/material.dart";

import "../../models/log_entry.dart";
import "../../theme/app_theme.dart";

const List<({String value, String label})> _kFields = [
  (value: "message", label: "Message"),
  (value: "level", label: "Level"),
  (value: "cluster_id", label: "Cluster"),
  (value: "source_id", label: "Source"),
  (value: "raw_text", label: "Raw Text"),
];

const List<({String value, String label})> _kOperators = [
  (value: "contains", label: "contains"),
  (value: "not_contains", label: "not contains"),
  (value: "equals", label: "is exactly"),
  (value: "not_equals", label: "is not"),
  (value: "starts_with", label: "starts with"),
  (value: "regex", label: "regex match"),
];

class FilterBuilder extends StatefulWidget {
  const FilterBuilder({super.key, required this.filters, required this.onChange});

  final List<LogFilter> filters;
  final ValueChanged<List<LogFilter>> onChange;

  @override
  State<FilterBuilder> createState() => _FilterBuilderState();
}

class _FilterBuilderState extends State<FilterBuilder> {
  bool _open = false;
  String _field = "raw_text";
  String _operator = "contains";
  final _valueController = TextEditingController();

  @override
  void dispose() {
    _valueController.dispose();
    super.dispose();
  }

  void _handleAdd() {
    final value = _valueController.text.trim();
    if (value.isEmpty) return;
    widget.onChange([...widget.filters, LogFilter(field: _field, operator: _operator, value: value)]);
    _valueController.clear();
    setState(() {});
  }

  void _handleRemove(int index) {
    final next = [...widget.filters]..removeAt(index);
    widget.onChange(next);
  }

  void _moveUp(int index) {
    if (index == 0) return;
    final next = [...widget.filters];
    final tmp = next[index - 1];
    next[index - 1] = next[index];
    next[index] = tmp;
    widget.onChange(next);
  }

  void _moveDown(int index) {
    if (index == widget.filters.length - 1) return;
    final next = [...widget.filters];
    final tmp = next[index + 1];
    next[index + 1] = next[index];
    next[index] = tmp;
    widget.onChange(next);
  }

  @override
  Widget build(BuildContext context) {
    final hasFilters = widget.filters.isNotEmpty;
    final active = _open || hasFilters;

    return Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      mainAxisSize: MainAxisSize.min,
      children: [
        Material(
          color: active ? AppColors.primary.withValues(alpha: 0.12) : AppColors.bgSurface,
          borderRadius: BorderRadius.circular(AppRadius.md),
          child: InkWell(
            onTap: () => setState(() => _open = !_open),
            borderRadius: BorderRadius.circular(AppRadius.md),
            child: Container(
              padding: const EdgeInsets.symmetric(horizontal: AppSpacing.sm, vertical: 6),
              decoration: BoxDecoration(
                borderRadius: BorderRadius.circular(AppRadius.md),
                border: Border.all(color: active ? AppColors.primary.withValues(alpha: 0.4) : AppColors.border),
              ),
              child: Row(
                mainAxisSize: MainAxisSize.min,
                children: [
                  Icon(Icons.filter_alt_outlined, size: 14, color: active ? AppColors.primary : AppColors.textMuted),
                  const SizedBox(width: 6),
                  Text(
                    "Filters",
                    style: TextStyle(
                      fontSize: 12,
                      fontWeight: FontWeight.w600,
                      color: active ? AppColors.primary : AppColors.textMuted,
                    ),
                  ),
                  if (hasFilters) ...[
                    const SizedBox(width: 4),
                    Container(
                      padding: const EdgeInsets.symmetric(horizontal: 4),
                      decoration: BoxDecoration(
                        color: AppColors.primary.withValues(alpha: 0.2),
                        borderRadius: BorderRadius.circular(4),
                      ),
                      child: Text(
                        "${widget.filters.length}",
                        style: const TextStyle(fontSize: 10, fontWeight: FontWeight.w700, color: AppColors.primary),
                      ),
                    ),
                  ],
                ],
              ),
            ),
          ),
        ),
        if (_open) _panel(),
      ],
    );
  }

  Widget _panel() {
    return Container(
      margin: const EdgeInsets.only(top: AppSpacing.xs),
      width: 288,
      decoration: BoxDecoration(
        color: AppColors.bgSurfaceBright,
        border: Border.all(color: AppColors.border),
        borderRadius: BorderRadius.circular(AppRadius.lg),
      ),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        mainAxisSize: MainAxisSize.min,
        children: [
          Padding(
            padding: const EdgeInsets.symmetric(horizontal: AppSpacing.sm, vertical: AppSpacing.xs),
            child: Text("Add Filter", style: AppTypography.h2.copyWith(fontSize: 12)),
          ),
          const Divider(height: 1, color: AppColors.borderMuted),
          Padding(
            padding: const EdgeInsets.all(AppSpacing.sm),
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Text("FIELD", style: AppTypography.labelCaps.copyWith(fontSize: 9)),
                const SizedBox(height: 4),
                Wrap(
                  spacing: 4,
                  runSpacing: 4,
                  children: _kFields
                      .map(
                        (f) => _pill(
                          label: f.label,
                          selected: _field == f.value,
                          selectedColor: AppColors.primary,
                          onTap: () => setState(() => _field = f.value),
                        ),
                      )
                      .toList(),
                ),
                const SizedBox(height: AppSpacing.sm),
                Text("OPERATOR", style: AppTypography.labelCaps.copyWith(fontSize: 9)),
                const SizedBox(height: 4),
                Wrap(
                  spacing: 4,
                  runSpacing: 4,
                  children: _kOperators
                      .map(
                        (op) => _pill(
                          label: op.label,
                          selected: _operator == op.value,
                          selectedColor: AppColors.textSecondary,
                          onTap: () => setState(() => _operator = op.value),
                        ),
                      )
                      .toList(),
                ),
                const SizedBox(height: AppSpacing.sm),
                Row(
                  children: [
                    Expanded(
                      child: TextField(
                        controller: _valueController,
                        decoration: const InputDecoration(isDense: true, hintText: "Value..."),
                        style: const TextStyle(fontSize: 12),
                        onSubmitted: (_) => _handleAdd(),
                        onChanged: (_) => setState(() {}),
                      ),
                    ),
                    const SizedBox(width: AppSpacing.xs),
                    IconButton(
                      onPressed: _handleAdd,
                      icon: const Icon(Icons.add),
                      style: IconButton.styleFrom(
                        backgroundColor: AppColors.primary,
                        foregroundColor: AppColors.textInverse,
                      ),
                    ),
                  ],
                ),
              ],
            ),
          ),
          if (hasFilters) ...[
            const Divider(height: 1, color: AppColors.borderMuted),
            Padding(
              padding: const EdgeInsets.all(AppSpacing.sm),
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  Row(
                    mainAxisAlignment: MainAxisAlignment.spaceBetween,
                    children: [
                      Text("ACTIVE", style: AppTypography.labelCaps.copyWith(fontSize: 9)),
                      InkWell(
                        onTap: () => widget.onChange(const []),
                        child: Text(
                          "Clear all",
                          style: AppTypography.body.copyWith(fontSize: 10, color: AppColors.textMuted),
                        ),
                      ),
                    ],
                  ),
                  const SizedBox(height: 4),
                  for (var i = 0; i < widget.filters.length; i++) _activeChip(i),
                ],
              ),
            ),
          ],
        ],
      ),
    );
  }

  bool get hasFilters => widget.filters.isNotEmpty;

  Widget _activeChip(int index) {
    final f = widget.filters[index];
    return Container(
      margin: const EdgeInsets.only(bottom: 4),
      padding: const EdgeInsets.symmetric(horizontal: 6, vertical: 4),
      decoration: BoxDecoration(
        color: AppColors.bgSurface,
        borderRadius: BorderRadius.circular(AppRadius.sm),
      ),
      child: Row(
        children: [
          Column(
            mainAxisSize: MainAxisSize.min,
            children: [
              InkWell(
                onTap: index == 0 ? null : () => _moveUp(index),
                child: Icon(Icons.arrow_drop_up, size: 14, color: index == 0 ? Colors.transparent : AppColors.textMuted),
              ),
              InkWell(
                onTap: index == widget.filters.length - 1 ? null : () => _moveDown(index),
                child: Icon(
                  Icons.arrow_drop_down,
                  size: 14,
                  color: index == widget.filters.length - 1 ? Colors.transparent : AppColors.textMuted,
                ),
              ),
            ],
          ),
          const SizedBox(width: 4),
          Text(
            f.field,
            style: TextStyle(fontSize: 10, fontWeight: FontWeight.w700, color: AppColors.primaryHover),
          ),
          const SizedBox(width: 4),
          Text(
            f.operator,
            style: AppTypography.body.copyWith(fontSize: 10, fontStyle: FontStyle.italic, color: AppColors.textMuted),
          ),
          const SizedBox(width: 4),
          Expanded(
            child: Text(
              f.value,
              maxLines: 1,
              overflow: TextOverflow.ellipsis,
              style: AppTypography.log.copyWith(fontSize: 12, color: AppColors.textPrimary),
            ),
          ),
          InkWell(
            onTap: () => _handleRemove(index),
            child: const Icon(Icons.close, size: 12, color: AppColors.textMuted),
          ),
        ],
      ),
    );
  }

  Widget _pill({
    required String label,
    required bool selected,
    required Color selectedColor,
    required VoidCallback onTap,
  }) {
    return Material(
      color: selected ? selectedColor : AppColors.bgSurface,
      borderRadius: BorderRadius.circular(AppRadius.sm),
      child: InkWell(
        onTap: onTap,
        borderRadius: BorderRadius.circular(AppRadius.sm),
        child: Padding(
          padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 3),
          child: Text(
            label,
            style: TextStyle(
              fontSize: 11,
              fontWeight: selected ? FontWeight.w600 : FontWeight.w400,
              color: selected ? AppColors.textInverse : AppColors.textMuted,
            ),
          ),
        ),
      ),
    );
  }
}
