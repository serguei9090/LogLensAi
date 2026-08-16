/// Mirrors the `FusionSourceConfig` interface defined inline in
/// `src/components/organisms/FusionConfigEngine.tsx` (there's no dedicated
/// TS type file for it -- it's local to that component). Per-source
/// multi-log-fusion settings: whether the source participates in the merged
/// stream, its clock-drift correction (`tz_offset`, in whole UTC hours), and
/// an optional custom timestamp format / extraction-parser config.
library;

class FusionSourceConfig {
  const FusionSourceConfig({
    required this.sourceId,
    required this.enabled,
    required this.tzOffset,
    this.customFormat,
    this.parserConfig,
  });

  /// The source's `path` (not its `id`) -- mirrors the React source keying
  /// fusion configs by `LogSource.path`.
  final String sourceId;
  final bool enabled;

  /// Whole-hour UTC offset applied to this source's timestamps before
  /// interleaving, range -12..+14 (mirrors `TIMEZONE_OPTIONS` in the React
  /// source).
  final int tzOffset;
  final String? customFormat;

  /// Raw JSON-encoded extraction-parser config, or `null` if unset. Opaque
  /// to this model -- owned/edited by whatever custom-parser UI is wired up
  /// (see `FusionConfigEngine.parserModalBuilder`).
  final String? parserConfig;

  factory FusionSourceConfig.fromJson(Map<String, dynamic> json) => FusionSourceConfig(
    sourceId: json["source_id"]?.toString() ?? "",
    enabled: json["enabled"] as bool? ?? true,
    tzOffset: (json["tz_offset"] as num?)?.toInt() ?? 0,
    customFormat: json["custom_format"] as String?,
    parserConfig: json["parser_config"] as String?,
  );

  Map<String, dynamic> toJson() => {
    "source_id": sourceId,
    "enabled": enabled,
    "tz_offset": tzOffset,
    "custom_format": customFormat,
    "parser_config": parserConfig,
  };

  FusionSourceConfig copyWith({
    String? sourceId,
    bool? enabled,
    int? tzOffset,
    Object? customFormat = _unset,
    Object? parserConfig = _unset,
  }) {
    return FusionSourceConfig(
      sourceId: sourceId ?? this.sourceId,
      enabled: enabled ?? this.enabled,
      tzOffset: tzOffset ?? this.tzOffset,
      customFormat: identical(customFormat, _unset) ? this.customFormat : customFormat as String?,
      parserConfig: identical(parserConfig, _unset) ? this.parserConfig : parserConfig as String?,
    );
  }
}

const Object _unset = Object();
