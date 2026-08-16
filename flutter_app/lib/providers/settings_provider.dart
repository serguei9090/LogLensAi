/// Port of `src/store/settingsStore.ts` (`useSettingsStore`).
library;

import "dart:async";
import "dart:convert";

import "package:flutter_riverpod/flutter_riverpod.dart";

import "../models/settings.dart";
import "../services/sidecar_bridge.dart";
import "sidecar_provider.dart";

class SettingsState {
  const SettingsState({this.settings = AppSettings.defaults});
  final AppSettings settings;

  SettingsState copyWith({AppSettings? settings}) =>
      SettingsState(settings: settings ?? this.settings);
}

class SettingsNotifier extends StateNotifier<SettingsState> {
  SettingsNotifier(this._bridge) : super(const SettingsState());

  final SidecarBridge _bridge;
  Timer? _saveTimer;

  Future<void> fetchSettings({String? workspaceId}) async {
    try {
      final remote = await _bridge.call<Map<String, dynamic>>(
        "get_settings",
        {"workspace_id": workspaceId},
      );
      state = state.copyWith(settings: AppSettings.fromRemote(remote));
    } catch (_) {
      // Mirror TS: log-and-keep-current-state on fetch failure.
    }
  }

  /// Applies [partial] to local state immediately (UI responsiveness), then
  /// debounces persistence to the sidecar by 500ms, mirroring
  /// `settingsStore.ts`'s `updateSettings`.
  Future<void> updateSettings(
    Map<String, dynamic> partial, {
    String? workspaceId,
  }) async {
    state = state.copyWith(settings: _applyPartial(state.settings, partial));

    _saveTimer?.cancel();
    _saveTimer = Timer(const Duration(milliseconds: 500), () async {
      try {
        final payload = <String, dynamic>{};
        for (final entry in partial.entries) {
          if (entry.key == "drain_masks" || entry.key == "facet_extractions") {
            payload[entry.key] = jsonEncode(entry.value);
          } else {
            payload[entry.key] = entry.value;
          }
        }
        await _bridge.call("update_settings", {
          "settings": payload,
          "workspace_id": workspaceId,
        });
      } catch (_) {
        // Mirror TS: log-and-continue.
      }
    });
  }

  AppSettings _applyPartial(AppSettings base, Map<String, dynamic> partial) {
    // Generic partial-merge over the handful of primitive fields the UI is
    // most likely to update from a form. Complex fields (drain_masks,
    // facet_extractions, ui_command_palette_shortcut) are set via their
    // typed copyWith overloads directly by callers when the Settings page
    // is built.
    return base.copyWith(
      aiProvider: partial["ai_provider"] as String?,
      aiModel: partial["ai_model"] as String?,
      aiApiKey: partial["ai_api_key"] as String?,
      aiSystemPrompt: partial["ai_system_prompt"] as String?,
      aiGeminiUrl: partial["ai_gemini_url"] as String?,
      aiOllamaHost: partial["ai_ollama_host"] as String?,
      aiOpenaiHost: partial["ai_openai_host"] as String?,
      aiLmstudioHost: partial["ai_lmstudio_host"] as String?,
      drainSimilarityThreshold: (partial["drain_similarity_threshold"] as num?)
          ?.toDouble(),
      drainMaxChildren: (partial["drain_max_children"] as num?)?.toInt(),
      drainMaxClusters: (partial["drain_max_clusters"] as num?)?.toInt(),
      uiRowHeight: partial["ui_row_height"] as String?,
      uiFontSize: partial["ui_font_size"] as String?,
      mcpServerEnabled: partial["mcp_server_enabled"] as bool?,
      aiToolSearch: partial["ai_tool_search"] as bool?,
      aiToolMemory: partial["ai_tool_memory"] as bool?,
      drainTemplateScope: partial["drain_template_scope"] as String?,
      ingestionSyslogEnabled: partial["ingestion_syslog_enabled"] as bool?,
      ingestionSyslogPort: (partial["ingestion_syslog_port"] as num?)?.toInt(),
      ingestionHttpEnabled: partial["ingestion_http_enabled"] as bool?,
      ingestionHttpPort: (partial["ingestion_http_port"] as num?)?.toInt(),
      timestampAutoDetect: partial["timestamp_auto_detect"] as bool?,
      timestampCustomRegex: partial["timestamp_custom_regex"] as String?,
      timestampCustomFormat: partial["timestamp_custom_format"] as String?,
    );
  }

  /// Restores every field to [AppSettings.defaults] and persists the full
  /// snapshot, mirroring `SettingsPanel.tsx`'s "Reset Settings"
  /// (`handleResetAll`, which calls the store's `updateSettings(defaultSettings)`
  /// wholesale rather than a partial patch).
  Future<void> resetToDefaults({String? workspaceId}) async {
    _saveTimer?.cancel();
    state = state.copyWith(settings: AppSettings.defaults);
    try {
      await _bridge.call("update_settings", {
        "settings": _fullPayload(AppSettings.defaults),
        "workspace_id": workspaceId,
      });
    } catch (_) {
      // Mirror TS: log-and-continue.
    }
  }

  Map<String, dynamic> _fullPayload(AppSettings s) => {
    "ai_provider": s.aiProvider,
    "ai_model": s.aiModel,
    "ai_api_key": s.aiApiKey,
    "ai_system_prompt": s.aiSystemPrompt,
    "ai_gemini_url": s.aiGeminiUrl,
    "ai_ollama_host": s.aiOllamaHost,
    "ai_openai_host": s.aiOpenaiHost,
    "ai_lmstudio_host": s.aiLmstudioHost,
    "drain_similarity_threshold": s.drainSimilarityThreshold,
    "drain_max_children": s.drainMaxChildren,
    "drain_max_clusters": s.drainMaxClusters,
    "ui_row_height": s.uiRowHeight,
    "ui_font_size": s.uiFontSize,
    "mcp_server_enabled": s.mcpServerEnabled,
    "ai_tool_search": s.aiToolSearch,
    "ai_tool_memory": s.aiToolMemory,
    "drain_template_scope": s.drainTemplateScope,
    "drain_masks": jsonEncode(s.drainMasks.map((m) => m.toJson()).toList()),
    "ingestion_syslog_enabled": s.ingestionSyslogEnabled,
    "ingestion_syslog_port": s.ingestionSyslogPort,
    "ingestion_http_enabled": s.ingestionHttpEnabled,
    "ingestion_http_port": s.ingestionHttpPort,
    "facet_extractions": jsonEncode(s.facetExtractions.map((r) => r.toJson()).toList()),
    "ui_command_palette_shortcut": jsonEncode(s.uiCommandPaletteShortcut.toJson()),
    "timestamp_auto_detect": s.timestampAutoDetect,
    "timestamp_custom_regex": s.timestampCustomRegex,
    "timestamp_custom_format": s.timestampCustomFormat,
  };

  /// Wipes all backend state (DB + workspaces) via `factory_reset`, mirroring
  /// `SettingsPanel.tsx`'s `handleFactoryReset`. Frontend-side store resets
  /// (workspace/ingestion/investigation) are the caller's responsibility --
  /// this only owns the settings slice and the RPC call, matching this
  /// provider's single-responsibility scope.
  Future<void> factoryReset() async {
    await _bridge.call("factory_reset", {});
    state = const SettingsState();
  }

  /// Round-trips `test_ai_connection`, mirroring `SettingsPanel.tsx`'s
  /// `handleTestConnection`. Returns the raw `{status, message}` result for
  /// the caller to surface (e.g. as a `SnackBar`).
  Future<Map<String, dynamic>> testAiConnection() {
    return _bridge.call<Map<String, dynamic>>("test_ai_connection", {});
  }

  /// Fetches the AI provider's available model list, mirroring
  /// `SettingsPanel.tsx`'s `fetchModels` (`list_ai_models` -> `string[]`).
  /// Returns `[]` on failure rather than throwing, matching the React
  /// `catch`-and-log behavior.
  Future<List<String>> fetchAvailableModels() async {
    try {
      final raw = await _bridge.call<List<dynamic>>("list_ai_models", {});
      return raw.map((e) => e.toString()).toList();
    } catch (_) {
      return const [];
    }
  }

  /// Clears the Drain3 pattern cache, mirroring `SettingsPanel.tsx`'s
  /// `handleResetPatterns` (`reset_templates`, workspace-scoped only when
  /// `drain_template_scope != "global"`).
  Future<void> resetTemplates({String? workspaceId}) {
    return _bridge.call("reset_templates", {
      "workspace_id": state.settings.drainTemplateScope == "global" ? null : workspaceId,
    });
  }

  // ── Complex-field setters (SettingsPanel) ────────────────────────────
  //
  // `updateSettings`'s partial merge (above) only understands the flat
  // primitive fields a raw `Map<String, dynamic>` partial can carry --
  // `drain_masks` / `facet_extractions` / `ui_command_palette_shortcut` are
  // typed lists/objects, so `SettingsPanel` (which edits all three) needs a
  // typed setter per field instead. Each mirrors `SettingsPanel.tsx`'s
  // `update("drain_masks", ...)` / `update("facet_extractions", ...)` /
  // `update("ui_command_palette_shortcut", ...)` calls: apply immediately to
  // local state, then debounce-persist the single changed key (reusing
  // `_saveTimer` -- same debounce slot as `updateSettings`, so rapid edits
  // across both a primitive field and a complex field still coalesce to the
  // last-write-wins single timer the React store's `updateSettings` implies).

  void setDrainMasks(List<DrainMask> masks, {String? workspaceId}) {
    state = state.copyWith(settings: state.settings.copyWith(drainMasks: masks));
    _debouncedPersist({
      "drain_masks": jsonEncode(masks.map((m) => m.toJson()).toList()),
    }, workspaceId);
  }

  void setFacetExtractions(List<FacetExtractionRule> rules, {String? workspaceId}) {
    state = state.copyWith(settings: state.settings.copyWith(facetExtractions: rules));
    _debouncedPersist({
      "facet_extractions": jsonEncode(rules.map((r) => r.toJson()).toList()),
    }, workspaceId);
  }

  void setCommandPaletteShortcut(KeyboardShortcut shortcut, {String? workspaceId}) {
    state = state.copyWith(settings: state.settings.copyWith(uiCommandPaletteShortcut: shortcut));
    _debouncedPersist({
      "ui_command_palette_shortcut": jsonEncode(shortcut.toJson()),
    }, workspaceId);
  }

  void _debouncedPersist(Map<String, dynamic> payload, String? workspaceId) {
    _saveTimer?.cancel();
    _saveTimer = Timer(const Duration(milliseconds: 500), () async {
      try {
        await _bridge.call("update_settings", {
          "settings": payload,
          "workspace_id": workspaceId,
        });
      } catch (_) {
        // Mirror TS: log-and-continue.
      }
    });
  }

  @override
  void dispose() {
    _saveTimer?.cancel();
    super.dispose();
  }
}

final settingsProvider = StateNotifierProvider<SettingsNotifier, SettingsState>((ref) {
  return SettingsNotifier(ref.watch(sidecarBridgeProvider));
});
