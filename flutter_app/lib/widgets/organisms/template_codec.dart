/// Shared JSON codec for the `{filters, highlights}` payload persisted via
/// `save_template` / read back from `get_templates`'s `config` field.
///
/// Mirrors the ad-hoc `JSON.stringify({filters, highlights})` /
/// `JSON.parse(template.config)` done inline in
/// `SaveTemplateModal.tsx`/`LoadTemplateModal.tsx`. Factored out here since
/// both `load_template_modal.dart` and `save_template_modal.dart` need the
/// identical encode/decode logic.
///
/// Uses the same `LogFilter` (from `models/log_entry.dart`) and
/// `HighlightRule` (from `widgets/molecules/highlight_builder.dart`) types
/// the already-built `FilterBuilder`/`HighlightBuilder` molecules use --
/// the TS `FilterEntry`/`HighlightEntry` types these mirror have no `id` in
/// their Dart port either (see those molecules' doc comments), so template
/// round-tripping doesn't need one.
library;

import "dart:convert";

import "package:flutter/material.dart";

import "../../models/log_entry.dart";
import "../molecules/highlight_builder.dart";

class TemplateConfig {
  const TemplateConfig({required this.filters, required this.highlights});

  final List<LogFilter> filters;
  final List<HighlightRule> highlights;

  String encode() => jsonEncode({
    "filters": filters.map((f) => f.toJson()).toList(),
    "highlights": highlights
        .map((h) => {"term": h.term, "color": _colorToHex(h.color)})
        .toList(),
  });

  static TemplateConfig decode(String raw) {
    final json = jsonDecode(raw) as Map<String, dynamic>;
    final filters = (json["filters"] as List<dynamic>? ?? const [])
        .map((f) => LogFilter.fromJson(f as Map<String, dynamic>))
        .toList();
    final highlights = (json["highlights"] as List<dynamic>? ?? const [])
        .map((h) {
          final m = h as Map<String, dynamic>;
          return HighlightRule(
            term: m["term"] as String? ?? "",
            color: _colorFromHex(m["color"] as String? ?? "#FBBF24"),
          );
        })
        .toList();
    return TemplateConfig(filters: filters, highlights: highlights);
  }
}

String _colorToHex(Color c) =>
    "#${c.toARGB32().toRadixString(16).padLeft(8, "0").substring(2)}";

Color _colorFromHex(String hex) {
  var s = hex.trim().replaceFirst("#", "");
  if (s.length == 6) s = "FF$s";
  final v = int.tryParse(s, radix: 16);
  return Color(v ?? 0xFFFBBF24);
}
