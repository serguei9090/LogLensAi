/// Dart port of `src/components/molecules/HighlightBuilder.tsx`.
///
/// Chip-based text-highlight rule editor: pick a color (from the
/// `AppColors.highlight1-5`/`AppColors.debug` preset palette, mirroring the
/// React `PRESET_COLORS`) and a keyword/regex term, add it to the active
/// highlight-rule list.
///
/// Deviations from the React source, both driven by not pulling in new
/// packages for this pass:
///  - The floating Radix `Popover` becomes an inline expanding panel below
///    the trigger chip (same rationale as `FilterBuilder`'s port note).
///  - The React version uses `react-colorful`'s `<HexColorPicker>` for a
///    freeform custom color. There's no Flutter color-picker package wired
///    into `pubspec.yaml` yet, so the custom-color affordance is a plain
///    hex `TextField` (`#RRGGBB`) instead of a saturation/hue picker --
///    functionally equivalent (any hex color can be typed), just without
///    the draggable gradient square. Recently-used custom colors are still
///    tracked exactly like the original (last 4, MRU-deduped).
///  - `HighlightRule` (this file, no shared model exists yet on the Dart
///    side either) drops the React `HighlightEntry.id` field -- rules are
///    removed by list index instead, for the same reason `FilterBuilder`
///    dropped `FilterEntry.id` (no UUID generator wired into this project).
library;

import "package:flutter/material.dart";

import "../../theme/app_theme.dart";

class HighlightRule {
  const HighlightRule({required this.term, required this.color});
  final String term;
  final Color color;
}

const List<({Color color, String name})> _kPresetColors = [
  (color: AppColors.highlight1, name: "Amber"),
  (color: AppColors.highlight2, name: "Blue"),
  (color: AppColors.highlight3, name: "Pink"),
  (color: AppColors.highlight4, name: "Emerald"),
  (color: AppColors.highlight5, name: "Orange"),
  (color: AppColors.debug, name: "Purple"),
];

class HighlightBuilder extends StatefulWidget {
  const HighlightBuilder({super.key, required this.highlights, required this.onChange});

  final List<HighlightRule> highlights;
  final ValueChanged<List<HighlightRule>> onChange;

  @override
  State<HighlightBuilder> createState() => _HighlightBuilderState();
}

class _HighlightBuilderState extends State<HighlightBuilder> {
  bool _open = false;
  Color _color = _kPresetColors.first.color;
  final _termController = TextEditingController();
  final _hexController = TextEditingController();
  final List<Color> _customColors = [];

  @override
  void dispose() {
    _termController.dispose();
    _hexController.dispose();
    super.dispose();
  }

  void _handleAdd() {
    final term = _termController.text.trim();
    if (term.isEmpty) return;
    widget.onChange([...widget.highlights, HighlightRule(term: term, color: _color)]);
    _termController.clear();
    setState(() {});
  }

  void _handleRemove(int index) {
    final next = [...widget.highlights]..removeAt(index);
    widget.onChange(next);
  }

  Color? _parseHex(String input) {
    var s = input.trim().replaceFirst("#", "");
    if (s.length == 6) s = "FF$s";
    if (s.length != 8) return null;
    final value = int.tryParse(s, radix: 16);
    return value == null ? null : Color(value);
  }

  void _confirmCustomColor() {
    final parsed = _parseHex(_hexController.text);
    if (parsed == null) return;
    setState(() {
      _customColors.removeWhere((c) => c.toARGB32() == parsed.toARGB32());
      _customColors.insert(0, parsed);
      if (_customColors.length > 4) _customColors.removeRange(4, _customColors.length);
      _color = parsed;
    });
  }

  @override
  Widget build(BuildContext context) {
    final hasHighlights = widget.highlights.isNotEmpty;
    final active = _open || hasHighlights;

    return Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      mainAxisSize: MainAxisSize.min,
      children: [
        Material(
          color: Colors.transparent,
          child: InkWell(
            onTap: () => setState(() => _open = !_open),
            borderRadius: BorderRadius.circular(AppRadius.md),
            child: Container(
              padding: const EdgeInsets.symmetric(horizontal: AppSpacing.sm, vertical: 6),
              decoration: BoxDecoration(
                color: active ? AppColors.highlight1.withValues(alpha: 0.15) : AppColors.bgSurface,
                borderRadius: BorderRadius.circular(AppRadius.md),
                border: Border.all(color: active ? AppColors.highlight1.withValues(alpha: 0.4) : AppColors.border),
              ),
              child: Row(
                mainAxisSize: MainAxisSize.min,
                children: [
                  Icon(Icons.highlight_alt, size: 14, color: active ? AppColors.highlight1 : AppColors.textMuted),
                  const SizedBox(width: 6),
                  Text(
                    "Highlights",
                    style: TextStyle(
                      fontSize: 12,
                      fontWeight: FontWeight.w600,
                      color: active ? AppColors.highlight1 : AppColors.textMuted,
                    ),
                  ),
                  if (hasHighlights) ...[
                    const SizedBox(width: 4),
                    Container(
                      padding: const EdgeInsets.symmetric(horizontal: 4),
                      decoration: BoxDecoration(
                        color: AppColors.highlight1.withValues(alpha: 0.2),
                        borderRadius: BorderRadius.circular(4),
                      ),
                      child: Text(
                        "${widget.highlights.length}",
                        style: const TextStyle(fontSize: 10, fontWeight: FontWeight.w700, color: AppColors.highlight1),
                      ),
                    ),
                  ],
                ],
              ),
            ),
          ),
        ),
        if (_open) _panel(hasHighlights),
      ],
    );
  }

  Widget _panel(bool hasHighlights) {
    return Container(
      margin: const EdgeInsets.only(top: AppSpacing.xs),
      width: 256,
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
            child: Text("Highlight Terms", style: AppTypography.h2.copyWith(fontSize: 12)),
          ),
          const Divider(height: 1, color: AppColors.borderMuted),
          Padding(
            padding: const EdgeInsets.all(AppSpacing.sm),
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Text("COLOR", style: AppTypography.labelCaps.copyWith(fontSize: 9)),
                const SizedBox(height: 6),
                Wrap(
                  spacing: 8,
                  runSpacing: 8,
                  crossAxisAlignment: WrapCrossAlignment.center,
                  children: [
                    for (final c in _customColors) _swatch(c, null),
                    for (final p in _kPresetColors) _swatch(p.color, p.name),
                  ],
                ),
                const SizedBox(height: AppSpacing.sm),
                Row(
                  children: [
                    Container(
                      width: 16,
                      height: 16,
                      margin: const EdgeInsets.only(right: 6),
                      decoration: BoxDecoration(
                        color: _color,
                        shape: BoxShape.circle,
                        border: Border.all(color: Colors.white.withValues(alpha: 0.2)),
                      ),
                    ),
                    Expanded(
                      child: TextField(
                        controller: _hexController,
                        decoration: const InputDecoration(isDense: true, hintText: "#RRGGBB"),
                        style: AppTypography.log.copyWith(fontSize: 11),
                      ),
                    ),
                    IconButton(
                      tooltip: "Confirm custom color",
                      onPressed: _confirmCustomColor,
                      icon: const Icon(Icons.check),
                      style: IconButton.styleFrom(
                        backgroundColor: AppColors.highlight1,
                        foregroundColor: AppColors.textInverse,
                      ),
                    ),
                  ],
                ),
                const SizedBox(height: AppSpacing.sm),
                Text("TERM", style: AppTypography.labelCaps.copyWith(fontSize: 9)),
                const SizedBox(height: 4),
                Row(
                  children: [
                    Expanded(
                      child: TextField(
                        controller: _termController,
                        decoration: const InputDecoration(isDense: true, hintText: "Term to highlight..."),
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
                        backgroundColor: AppColors.highlight1,
                        foregroundColor: AppColors.textInverse,
                      ),
                    ),
                  ],
                ),
              ],
            ),
          ),
          if (hasHighlights) ...[
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
                  for (var i = 0; i < widget.highlights.length; i++) _activeChip(i),
                ],
              ),
            ),
          ],
        ],
      ),
    );
  }

  Widget _swatch(Color color, String? tooltip) {
    final selected = color.toARGB32() == _color.toARGB32();
    final swatch = InkWell(
      onTap: () => setState(() => _color = color),
      customBorder: const CircleBorder(),
      child: Container(
        width: 18,
        height: 18,
        decoration: BoxDecoration(
          color: color,
          shape: BoxShape.circle,
          border: Border.all(color: selected ? Colors.white : Colors.transparent, width: 2),
        ),
      ),
    );
    return tooltip == null ? swatch : Tooltip(message: tooltip, child: swatch);
  }

  Widget _activeChip(int index) {
    final h = widget.highlights[index];
    return Container(
      margin: const EdgeInsets.only(bottom: 4),
      padding: const EdgeInsets.symmetric(horizontal: 6, vertical: 4),
      decoration: BoxDecoration(color: AppColors.bgSurface, borderRadius: BorderRadius.circular(AppRadius.sm)),
      child: Row(
        children: [
          Container(width: 10, height: 10, decoration: BoxDecoration(color: h.color, shape: BoxShape.circle)),
          const SizedBox(width: 6),
          Expanded(
            child: Text(
              h.term,
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
}
