/// Mirrors `src/store/settingsStore.ts`'s `AppSettings` / `KeyboardShortcut`
/// / `defaultSettings`.
library;

import "dart:convert";

/// Mirrors `settingsStore.ts`'s `safeParse`: tries strict JSON first, then
/// falls back to a naive Python-`repr()`-style string (single quotes,
/// `True`/`False`/`None`) in case the sidecar ever round-trips that instead
/// of `json.dumps()`. Returns `null` on total failure or an empty/absent
/// input.
dynamic _safeParse(String? raw) {
  if (raw == null || raw.isEmpty) return null;
  try {
    return jsonDecode(raw);
  } catch (_) {
    try {
      final jsonified = raw
          .replaceAll("'", '"')
          .replaceAll("True", "true")
          .replaceAll("False", "false")
          .replaceAll("None", "null");
      return jsonDecode(jsonified);
    } catch (_) {
      return null;
    }
  }
}

class KeyboardShortcut {
  const KeyboardShortcut({
    required this.key,
    this.ctrl = false,
    this.alt = false,
    this.shift = false,
    this.meta = false,
  });

  final String key;
  final bool ctrl;
  final bool alt;
  final bool shift;
  final bool meta;

  factory KeyboardShortcut.fromJson(Map<String, dynamic> json) => KeyboardShortcut(
    key: json["key"] as String? ?? "",
    ctrl: json["ctrl"] as bool? ?? false,
    alt: json["alt"] as bool? ?? false,
    shift: json["shift"] as bool? ?? false,
    meta: json["meta"] as bool? ?? false,
  );

  Map<String, dynamic> toJson() => {
    "key": key,
    "ctrl": ctrl,
    "alt": alt,
    "shift": shift,
    "meta": meta,
  };
}

class DrainMask {
  const DrainMask({required this.pattern, required this.label, required this.enabled});

  final String pattern;
  final String label;
  final bool enabled;

  factory DrainMask.fromJson(Map<String, dynamic> json) => DrainMask(
    pattern: json["pattern"] as String? ?? "",
    label: json["label"] as String? ?? "",
    enabled: json["enabled"] as bool? ?? true,
  );

  Map<String, dynamic> toJson() => {
    "pattern": pattern,
    "label": label,
    "enabled": enabled,
  };
}

class FacetExtractionRule {
  const FacetExtractionRule({
    required this.name,
    required this.regex,
    required this.group,
    required this.enabled,
  });

  final String name;
  final String regex;
  final int group;
  final bool enabled;

  factory FacetExtractionRule.fromJson(Map<String, dynamic> json) => FacetExtractionRule(
    name: json["name"] as String? ?? "",
    regex: json["regex"] as String? ?? "",
    group: (json["group"] as num?)?.toInt() ?? 1,
    enabled: json["enabled"] as bool? ?? true,
  );

  Map<String, dynamic> toJson() => {
    "name": name,
    "regex": regex,
    "group": group,
    "enabled": enabled,
  };
}

class AppSettings {
  const AppSettings({
    required this.aiProvider,
    required this.aiModel,
    required this.aiApiKey,
    required this.aiSystemPrompt,
    required this.aiGeminiUrl,
    required this.aiOllamaHost,
    required this.aiOpenaiHost,
    required this.aiLmstudioHost,
    required this.drainSimilarityThreshold,
    required this.drainMaxChildren,
    required this.drainMaxClusters,
    required this.uiRowHeight,
    required this.uiFontSize,
    required this.mcpServerEnabled,
    required this.aiToolSearch,
    required this.aiToolMemory,
    required this.drainTemplateScope,
    required this.drainMasks,
    required this.ingestionSyslogEnabled,
    required this.ingestionSyslogPort,
    required this.ingestionHttpEnabled,
    required this.ingestionHttpPort,
    required this.facetExtractions,
    required this.uiCommandPaletteShortcut,
    required this.timestampAutoDetect,
    required this.timestampCustomRegex,
    required this.timestampCustomFormat,
  });

  final String aiProvider;
  final String aiModel;
  final String aiApiKey;
  final String aiSystemPrompt;
  final String aiGeminiUrl;
  final String aiOllamaHost;
  final String aiOpenaiHost;
  final String aiLmstudioHost;
  final double drainSimilarityThreshold;
  final int drainMaxChildren;
  final int drainMaxClusters;
  final String uiRowHeight;
  final String uiFontSize;
  final bool mcpServerEnabled;
  final bool aiToolSearch;
  final bool aiToolMemory;
  /// 'global' | 'workspace'
  final String drainTemplateScope;
  final List<DrainMask> drainMasks;
  final bool ingestionSyslogEnabled;
  final int ingestionSyslogPort;
  final bool ingestionHttpEnabled;
  final int ingestionHttpPort;
  final List<FacetExtractionRule> facetExtractions;
  final KeyboardShortcut uiCommandPaletteShortcut;
  final bool timestampAutoDetect;
  final String timestampCustomRegex;
  final String timestampCustomFormat;

  static const AppSettings defaults = AppSettings(
    aiProvider: "ollama",
    aiModel: "gemma4:e2b",
    aiApiKey: "",
    aiSystemPrompt:
        "You are LogLens Assistant, a senior DevOps engineer and SRE specializing in root cause analysis.",
    aiGeminiUrl: "http://localhost:22436",
    aiOllamaHost: "http://localhost:11434",
    aiOpenaiHost: "https://api.openai.com/v1",
    aiLmstudioHost: "http://localhost:1234/v1",
    drainSimilarityThreshold: 0.5,
    drainMaxChildren: 100,
    drainMaxClusters: 1000,
    uiRowHeight: "36px",
    uiFontSize: "13px",
    mcpServerEnabled: false,
    aiToolSearch: true,
    aiToolMemory: true,
    drainTemplateScope: "global",
    drainMasks: [
      DrainMask(
        pattern: r"\b(\d{1,3}\.\d{1,3}\.\d{1,3}\.\d{1,3})\b",
        label: "IP",
        enabled: true,
      ),
      DrainMask(
        pattern: "[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{12}",
        label: "UUID",
        enabled: true,
      ),
      DrainMask(pattern: r"\b([1-5][0-9]{2})\b", label: "HTTP_STATUS", enabled: true),
      DrainMask(
        pattern: r"\b(GET|POST|PUT|DELETE|PATCH|HEAD|OPTIONS|TRACE)\b",
        label: "HTTP_METHOD",
        enabled: true,
      ),
    ],
    ingestionSyslogEnabled: true,
    ingestionSyslogPort: 514,
    ingestionHttpEnabled: true,
    ingestionHttpPort: 5002,
    facetExtractions: [],
    uiCommandPaletteShortcut: KeyboardShortcut(key: "k", ctrl: true),
    timestampAutoDetect: true,
    timestampCustomRegex: "",
    timestampCustomFormat: "",
  );

  AppSettings copyWith({
    String? aiProvider,
    String? aiModel,
    String? aiApiKey,
    String? aiSystemPrompt,
    String? aiGeminiUrl,
    String? aiOllamaHost,
    String? aiOpenaiHost,
    String? aiLmstudioHost,
    double? drainSimilarityThreshold,
    int? drainMaxChildren,
    int? drainMaxClusters,
    String? uiRowHeight,
    String? uiFontSize,
    bool? mcpServerEnabled,
    bool? aiToolSearch,
    bool? aiToolMemory,
    String? drainTemplateScope,
    List<DrainMask>? drainMasks,
    bool? ingestionSyslogEnabled,
    int? ingestionSyslogPort,
    bool? ingestionHttpEnabled,
    int? ingestionHttpPort,
    List<FacetExtractionRule>? facetExtractions,
    KeyboardShortcut? uiCommandPaletteShortcut,
    bool? timestampAutoDetect,
    String? timestampCustomRegex,
    String? timestampCustomFormat,
  }) {
    return AppSettings(
      aiProvider: aiProvider ?? this.aiProvider,
      aiModel: aiModel ?? this.aiModel,
      aiApiKey: aiApiKey ?? this.aiApiKey,
      aiSystemPrompt: aiSystemPrompt ?? this.aiSystemPrompt,
      aiGeminiUrl: aiGeminiUrl ?? this.aiGeminiUrl,
      aiOllamaHost: aiOllamaHost ?? this.aiOllamaHost,
      aiOpenaiHost: aiOpenaiHost ?? this.aiOpenaiHost,
      aiLmstudioHost: aiLmstudioHost ?? this.aiLmstudioHost,
      drainSimilarityThreshold: drainSimilarityThreshold ?? this.drainSimilarityThreshold,
      drainMaxChildren: drainMaxChildren ?? this.drainMaxChildren,
      drainMaxClusters: drainMaxClusters ?? this.drainMaxClusters,
      uiRowHeight: uiRowHeight ?? this.uiRowHeight,
      uiFontSize: uiFontSize ?? this.uiFontSize,
      mcpServerEnabled: mcpServerEnabled ?? this.mcpServerEnabled,
      aiToolSearch: aiToolSearch ?? this.aiToolSearch,
      aiToolMemory: aiToolMemory ?? this.aiToolMemory,
      drainTemplateScope: drainTemplateScope ?? this.drainTemplateScope,
      drainMasks: drainMasks ?? this.drainMasks,
      ingestionSyslogEnabled: ingestionSyslogEnabled ?? this.ingestionSyslogEnabled,
      ingestionSyslogPort: ingestionSyslogPort ?? this.ingestionSyslogPort,
      ingestionHttpEnabled: ingestionHttpEnabled ?? this.ingestionHttpEnabled,
      ingestionHttpPort: ingestionHttpPort ?? this.ingestionHttpPort,
      facetExtractions: facetExtractions ?? this.facetExtractions,
      uiCommandPaletteShortcut: uiCommandPaletteShortcut ?? this.uiCommandPaletteShortcut,
      timestampAutoDetect: timestampAutoDetect ?? this.timestampAutoDetect,
      timestampCustomRegex: timestampCustomRegex ?? this.timestampCustomRegex,
      timestampCustomFormat: timestampCustomFormat ?? this.timestampCustomFormat,
    );
  }

  /// Merges a raw `Map<String, String>` returned by `get_settings` (the
  /// sidecar stores everything as strings) on top of [defaults], mirroring
  /// `settingsStore.ts`'s `fetchSettings` parsing logic.
  factory AppSettings.fromRemote(Map<String, dynamic> remote) {
    bool boolOr(String key, bool fallback) {
      final v = remote[key];
      if (v == null) return fallback;
      return v.toString().toLowerCase() != "false";
    }

    double parseDouble(String key, double fallback) {
      final v = remote[key];
      if (v == null) return fallback;
      return double.tryParse(v.toString()) ?? fallback;
    }

    int parseInt(String key, int fallback) {
      final v = remote[key];
      if (v == null) return fallback;
      return int.tryParse(v.toString()) ?? fallback;
    }

    String strOr(String key, String fallback) => remote[key]?.toString() ?? fallback;

    return defaults.copyWith(
      aiProvider: strOr("ai_provider", defaults.aiProvider),
      aiModel: strOr("ai_model", defaults.aiModel),
      aiApiKey: strOr("ai_api_key", defaults.aiApiKey),
      aiSystemPrompt: strOr("ai_system_prompt", defaults.aiSystemPrompt),
      aiGeminiUrl: strOr("ai_gemini_url", defaults.aiGeminiUrl),
      aiOllamaHost: strOr("ai_ollama_host", defaults.aiOllamaHost),
      aiOpenaiHost: strOr("ai_openai_host", defaults.aiOpenaiHost),
      aiLmstudioHost: strOr("ai_lmstudio_host", defaults.aiLmstudioHost),
      drainSimilarityThreshold: parseDouble(
        "drain_similarity_threshold",
        defaults.drainSimilarityThreshold,
      ),
      drainMaxChildren: parseInt("drain_max_children", defaults.drainMaxChildren),
      drainMaxClusters: parseInt("drain_max_clusters", defaults.drainMaxClusters),
      mcpServerEnabled: boolOr("mcp_server_enabled", false),
      aiToolSearch: boolOr("ai_tool_search", true),
      aiToolMemory: boolOr("ai_tool_memory", true),
      drainTemplateScope: strOr("drain_template_scope", defaults.drainTemplateScope),
      ingestionSyslogEnabled: boolOr("ingestion_syslog_enabled", true),
      ingestionSyslogPort: parseInt("ingestion_syslog_port", defaults.ingestionSyslogPort),
      ingestionHttpEnabled: boolOr("ingestion_http_enabled", true),
      ingestionHttpPort: parseInt("ingestion_http_port", defaults.ingestionHttpPort),
      timestampAutoDetect: boolOr("timestamp_auto_detect", true),
      timestampCustomRegex: strOr("timestamp_custom_regex", ""),
      timestampCustomFormat: strOr("timestamp_custom_format", ""),
      // drain_masks / facet_extractions / ui_command_palette_shortcut arrive
      // JSON-encoded as strings -- parsed below via the same `safeParse`
      // fallback logic as `settingsStore.ts`'s `parseRemote` (now that the
      // Settings page consumes them).
      drainMasks: _parseDrainMasks(remote["drain_masks"] as String?),
      facetExtractions: _parseFacetExtractions(remote["facet_extractions"] as String?),
      uiCommandPaletteShortcut: _parseShortcut(remote["ui_command_palette_shortcut"]),
    );
  }

  static List<DrainMask>? _parseDrainMasks(String? raw) {
    final parsed = _safeParse(raw);
    if (parsed is! List) return null;
    final list = parsed
        .whereType<Map>()
        .map((m) => DrainMask.fromJson(Map<String, dynamic>.from(m)))
        .where((m) => m.label.trim().isNotEmpty || m.pattern.trim().isNotEmpty)
        .toList();
    return list.isNotEmpty ? list : null;
  }

  static List<FacetExtractionRule>? _parseFacetExtractions(String? raw) {
    final parsed = _safeParse(raw);
    if (parsed is! List) return null;
    return parsed
        .whereType<Map>()
        .map((f) => FacetExtractionRule.fromJson(Map<String, dynamic>.from(f)))
        .where((f) => f.name.trim().isNotEmpty || f.regex.trim().isNotEmpty)
        .toList();
  }

  static KeyboardShortcut? _parseShortcut(Object? raw) {
    if (raw is String && raw.length == 1) {
      // Legacy support: a bare single-character string.
      return KeyboardShortcut(key: raw, ctrl: true);
    }
    final parsed = _safeParse(raw is String ? raw : null);
    if (parsed is Map && parsed.containsKey("key")) {
      return KeyboardShortcut.fromJson(Map<String, dynamic>.from(parsed));
    }
    return null;
  }
}
