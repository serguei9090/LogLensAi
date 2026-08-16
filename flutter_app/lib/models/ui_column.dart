/// Mirrors `src/store/uiStore.ts`'s `CustomColumnDef`.
class CustomColumnDef {
  const CustomColumnDef({
    required this.id,
    required this.label,
    required this.width,
    required this.source,
    this.regex,
  });

  /// Unique key — also the facets key for auto columns, or a uuid for user columns.
  final String id;

  /// Display label in the table header.
  final String label;

  /// Column width CSS value (kept as a string to mirror the TS shape;
  /// the Flutter table widget parses `px`/`fr` at render time).
  final String width;

  /// "auto" = extracted by backend into facets, "user" = frontend regex column.
  final String source;

  /// Regex pattern (capture group 1 = cell value). Only used for source=="user".
  final String? regex;

  static const List<CustomColumnDef> defaults = [
    CustomColumnDef(id: "http_method", label: "Method", width: "80px", source: "auto"),
    CustomColumnDef(id: "http_status", label: "Status", width: "72px", source: "auto"),
  ];
}
