/// Mirrors the `Template` interface defined inline in
/// `src/components/organisms/LoadTemplateModal.tsx` (also local to that
/// component, no dedicated TS type file). A saved filter/highlight
/// configuration row, as returned by the `get_templates` RPC method.
library;

class Template {
  const Template({
    required this.id,
    required this.name,
    required this.config,
    required this.createdAt,
  });

  final int id;
  final String name;

  /// Raw JSON-encoded `{filters, highlights}` payload -- see
  /// `lib/widgets/organisms/template_codec.dart` for the codec that
  /// (de)serializes this into typed `LogFilter`/`HighlightRule` lists.
  final String config;
  final String createdAt;

  factory Template.fromJson(Map<String, dynamic> json) => Template(
    id: (json["id"] as num).toInt(),
    name: json["name"] as String? ?? "",
    config: json["config"] as String? ?? "{}",
    createdAt: json["created_at"] as String? ?? "",
  );
}
