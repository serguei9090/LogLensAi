/// Dart port of `src/components/organisms/SettingsPanel.tsx`.
///
/// The full application-settings page: a left nav switching between four
/// sections (AI Intelligence, Engine Core/Drain3, Ingestion, Interface) and
/// a right content pane bound to [settingsProvider], with auto-save,
/// destructive-action confirmations (Reset Settings / Clear Pattern Cache /
/// Factory Reset), and an AI-connection test action.
///
/// Deviations from the React source:
///  - The React version is a controlled component driven entirely by an
///    `onSave: (settings) => void` prop threaded down from `App.tsx` (which
///    forwards `useSettingsStore`). Per this migration batch's established
///    convention (see [Sidebar]'s doc comment for the same call), this port
///    reads [settingsProvider] directly instead -- there is no `onSave`
///    prop; every field writes straight through the provider's own
///    debounced-persist methods.
///  - `drain_masks` / `facet_extractions` / `ui_command_palette_shortcut`
///    are complex (list/object) fields that `SettingsNotifier.updateSettings`
///    intentionally doesn't merge (see that method's doc comment). This
///    widget is what motivated the three new typed setters added there in
///    this pass -- [SettingsNotifier.setDrainMasks] /
///    `.setFacetExtractions` / `.setCommandPaletteShortcut` -- see that
///    file for their doc comments. [AppSettings.fromRemote] was also
///    extended in this pass to actually parse those three JSON-encoded
///    string fields (previously left at defaults per its own doc comment
///    -- "wire up when the Settings page lands").
///  - "Row Density" options are the raw `AppSettings.uiRowHeight` pixel
///    strings already baked into the Dart model's `defaults`
///    (`"28px"`/`"36px"`/`"44px"`) rather than the React source's semantic
///    `"compact"`/`"default"`/`"comfortable"` keys -- the Dart port of the
///    settings model (an earlier pass, not this one) already committed to
///    storing literal pixel values, so the dropdown here matches what the
///    model actually persists instead of introducing a second encoding.
///  - The "Add Custom AI Skill" upload flow (skill-folder file picker +
///    "Install Skill" button) doesn't call any real RPC method in the React
///    source either (no backend endpoint exists for it) -- it's dropped
///    here rather than porting a dead-end upload form. The "Enable Log
///    Search Tool" / "Enable Associative Memory" toggles (real,
///    settings-backed) are kept.
///  - `ShortcutCapture`'s `window.addEventListener("keydown", ..., true)`
///    capture-phase recording becomes a [Focus] widget's `onKeyEvent`,
///    reading live modifier state off [HardwareKeyboard.instance].
///  - No page-reload-after-reset behavior (`globalThis.location.reload()`)
///    -- there's no equivalent concept for a native desktop app; the
///    provider's in-memory state update is the reload's effective replacement.
library;

import "dart:async";

import "package:flutter/material.dart";
import "package:flutter/services.dart";
import "package:flutter_riverpod/flutter_riverpod.dart";

import "../../models/settings.dart";
import "../../providers/settings_provider.dart";
import "../../theme/app_theme.dart";
import "../atoms/help_tooltip.dart";
import "../molecules/confirmation_dialog.dart";
import "../molecules/facet_extraction_settings.dart";

enum _Section { ai, drain, ingestion, general }

const List<String> _kDynamicModelProviders = ["ollama", "lmstudio", "openai-compatible", "ai-studio"];

class SettingsPanel extends ConsumerStatefulWidget {
  const SettingsPanel({super.key, this.workspaceId});

  /// Passed through to every [settingsProvider] persistence call. `null`
  /// (the default) targets global settings, matching most React call sites
  /// (`SettingsPanel.tsx` itself never threads a workspace id through).
  final String? workspaceId;

  @override
  ConsumerState<SettingsPanel> createState() => _SettingsPanelState();
}

class _SettingsPanelState extends ConsumerState<SettingsPanel> {
  _Section _activeSection = _Section.ai;
  bool _saved = false;
  Timer? _savedTimer;

  bool _isToolsExpanded = false;
  bool _showApiKey = false;
  bool _isTestingConnection = false;
  bool _isRestarting = false;

  List<String> _availableModels = const [];
  bool _isFetchingModels = false;
  Timer? _modelFetchDebounce;
  String? _lastModelFetchKey;

  late final TextEditingController _geminiUrlCtrl;
  late final TextEditingController _ollamaHostCtrl;
  late final TextEditingController _lmstudioHostCtrl;
  late final TextEditingController _openaiHostCtrl;
  late final TextEditingController _apiKeyCtrl;
  late final TextEditingController _systemPromptCtrl;
  late final TextEditingController _drainSimCtrl;
  late final TextEditingController _drainChildrenCtrl;
  late final TextEditingController _drainClustersCtrl;
  late final TextEditingController _tsRegexCtrl;
  late final TextEditingController _tsFormatCtrl;
  late final TextEditingController _syslogPortCtrl;
  late final TextEditingController _httpPortCtrl;

  @override
  void initState() {
    super.initState();
    final s = ref.read(settingsProvider).settings;
    _geminiUrlCtrl = TextEditingController(text: s.aiGeminiUrl);
    _ollamaHostCtrl = TextEditingController(text: s.aiOllamaHost);
    _lmstudioHostCtrl = TextEditingController(text: s.aiLmstudioHost);
    _openaiHostCtrl = TextEditingController(text: s.aiOpenaiHost);
    _apiKeyCtrl = TextEditingController(text: s.aiApiKey);
    _systemPromptCtrl = TextEditingController(text: s.aiSystemPrompt);
    _drainSimCtrl = TextEditingController(text: s.drainSimilarityThreshold.toString());
    _drainChildrenCtrl = TextEditingController(text: s.drainMaxChildren.toString());
    _drainClustersCtrl = TextEditingController(text: s.drainMaxClusters.toString());
    _tsRegexCtrl = TextEditingController(text: s.timestampCustomRegex);
    _tsFormatCtrl = TextEditingController(text: s.timestampCustomFormat);
    _syslogPortCtrl = TextEditingController(text: s.ingestionSyslogPort.toString());
    _httpPortCtrl = TextEditingController(text: s.ingestionHttpPort.toString());

    WidgetsBinding.instance.addPostFrameCallback((_) async {
      await ref.read(settingsProvider.notifier).fetchSettings(workspaceId: widget.workspaceId);
      if (mounted) unawaited(_fetchModelsIfNeeded(ref.read(settingsProvider).settings));
    });
  }

  @override
  void dispose() {
    _savedTimer?.cancel();
    _modelFetchDebounce?.cancel();
    _geminiUrlCtrl.dispose();
    _ollamaHostCtrl.dispose();
    _lmstudioHostCtrl.dispose();
    _openaiHostCtrl.dispose();
    _apiKeyCtrl.dispose();
    _systemPromptCtrl.dispose();
    _drainSimCtrl.dispose();
    _drainChildrenCtrl.dispose();
    _drainClustersCtrl.dispose();
    _tsRegexCtrl.dispose();
    _tsFormatCtrl.dispose();
    _syslogPortCtrl.dispose();
    _httpPortCtrl.dispose();
    super.dispose();
  }

  void _syncText(TextEditingController controller, String value) {
    if (controller.text != value) controller.text = value;
  }

  void _flashSaved() {
    setState(() => _saved = true);
    _savedTimer?.cancel();
    _savedTimer = Timer(const Duration(seconds: 2), () {
      if (mounted) setState(() => _saved = false);
    });
  }

  void _update(Map<String, dynamic> partial) {
    ref.read(settingsProvider.notifier).updateSettings(partial, workspaceId: widget.workspaceId);
    _flashSaved();
  }

  Future<void> _fetchModelsIfNeeded(AppSettings s) async {
    if (!_kDynamicModelProviders.contains(s.aiProvider)) return;
    final key = "${s.aiProvider}|${s.aiApiKey}|${s.aiOllamaHost}|${s.aiLmstudioHost}|${s.aiOpenaiHost}";
    if (key == _lastModelFetchKey) return;
    _lastModelFetchKey = key;
    _modelFetchDebounce?.cancel();
    _modelFetchDebounce = Timer(const Duration(seconds: 1), () async {
      if (!mounted) return;
      setState(() => _isFetchingModels = true);
      final models = await ref.read(settingsProvider.notifier).fetchAvailableModels();
      if (!mounted) return;
      setState(() {
        _availableModels = models;
        _isFetchingModels = false;
      });
    });
  }

  void _showSnack(String message) {
    if (!mounted) return;
    ScaffoldMessenger.of(context).showSnackBar(SnackBar(content: Text(message)));
  }

  Future<void> _handleTestConnection() async {
    setState(() => _isTestingConnection = true);
    try {
      final res = await ref.read(settingsProvider.notifier).testAiConnection();
      final msg = res["message"]?.toString() ?? "Connection tested.";
      _showSnack(msg);
    } catch (_) {
      _showSnack("Failed to test connection");
    } finally {
      if (mounted) setState(() => _isTestingConnection = false);
    }
  }

  Future<void> _handleResetAll() async {
    await ref.read(settingsProvider.notifier).resetToDefaults(workspaceId: widget.workspaceId);
    _showSnack("Settings reset to defaults successfully");
  }

  Future<void> _handleResetPatterns() async {
    try {
      await ref.read(settingsProvider.notifier).resetTemplates(workspaceId: widget.workspaceId);
      _showSnack("Pattern cache cleared successfully");
    } catch (_) {
      _showSnack("Failed to reset patterns");
    }
  }

  Future<void> _handleFactoryReset() async {
    setState(() => _isRestarting = true);
    try {
      await ref.read(settingsProvider.notifier).factoryReset();
      _showSnack("Factory reset complete.");
    } catch (_) {
      _showSnack("Factory reset failed. Manual cleanup may be required.");
    } finally {
      if (mounted) {
        await Future<void>.delayed(const Duration(milliseconds: 600));
        if (mounted) setState(() => _isRestarting = false);
      }
    }
  }

  @override
  Widget build(BuildContext context) {
    ref.listen<SettingsState>(settingsProvider, (previous, next) {
      final s = next.settings;
      _syncText(_geminiUrlCtrl, s.aiGeminiUrl);
      _syncText(_ollamaHostCtrl, s.aiOllamaHost);
      _syncText(_lmstudioHostCtrl, s.aiLmstudioHost);
      _syncText(_openaiHostCtrl, s.aiOpenaiHost);
      _syncText(_apiKeyCtrl, s.aiApiKey);
      _syncText(_systemPromptCtrl, s.aiSystemPrompt);
      _syncText(_drainSimCtrl, s.drainSimilarityThreshold.toString());
      _syncText(_drainChildrenCtrl, s.drainMaxChildren.toString());
      _syncText(_drainClustersCtrl, s.drainMaxClusters.toString());
      _syncText(_tsRegexCtrl, s.timestampCustomRegex);
      _syncText(_tsFormatCtrl, s.timestampCustomFormat);
      _syncText(_syslogPortCtrl, s.ingestionSyslogPort.toString());
      _syncText(_httpPortCtrl, s.ingestionHttpPort.toString());
      unawaited(_fetchModelsIfNeeded(s));
    });

    final settings = ref.watch(settingsProvider).settings;

    return Stack(
      children: [
        ColoredBox(
          color: AppColors.bgBase,
          child: Row(
            crossAxisAlignment: CrossAxisAlignment.stretch,
            children: [
              _buildNav(),
              Expanded(
                child: SingleChildScrollView(
                  padding: const EdgeInsets.symmetric(horizontal: AppSpacing.xl, vertical: AppSpacing.xl),
                  child: ConstrainedBox(
                    constraints: const BoxConstraints(maxWidth: 720),
                    child: _buildSection(settings),
                  ),
                ),
              ),
            ],
          ),
        ),
        if (_isRestarting)
          Positioned.fill(
            child: ColoredBox(
              color: AppColors.bgApp.withValues(alpha: 0.95),
              child: const Center(
                child: Column(
                  mainAxisSize: MainAxisSize.min,
                  children: [
                    CircularProgressIndicator(),
                    SizedBox(height: AppSpacing.md),
                    Text("Initializing System...", style: TextStyle(fontSize: 20, fontWeight: FontWeight.bold)),
                  ],
                ),
              ),
            ),
          ),
      ],
    );
  }

  // ── Nav ────────────────────────────────────────────────────────────────

  static const List<(_Section, IconData, String, String)> _kSections = [
    (_Section.ai, Icons.smart_toy_outlined, "AI Intelligence", "Model & analyze logic"),
    (_Section.drain, Icons.memory, "Engine Core", "Clustering parameters"),
    (_Section.ingestion, Icons.hub_outlined, "Ingestion", "Live stream listeners"),
    (_Section.general, Icons.palette_outlined, "Interface", "Display & accessibility"),
  ];

  Widget _buildNav() {
    return Container(
      width: 256,
      padding: const EdgeInsets.all(AppSpacing.lg),
      decoration: const BoxDecoration(
        color: Color(0x08FFFFFF),
        border: Border(right: BorderSide(color: AppColors.borderSubtle)),
      ),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Text("Settings", style: AppTypography.h1.copyWith(fontSize: 20)),
          const SizedBox(height: 4),
          Text(
            "Configure your log analysis environment",
            style: AppTypography.body.copyWith(fontSize: 12, color: AppColors.textMuted),
          ),
          const SizedBox(height: AppSpacing.xl),
          for (final section in _kSections)
            Padding(
              padding: const EdgeInsets.only(bottom: 6),
              child: _NavButton(
                icon: section.$2,
                label: section.$3,
                desc: section.$4,
                active: _activeSection == section.$1,
                onTap: () => setState(() => _activeSection = section.$1),
              ),
            ),
          const Spacer(),
          Container(
            padding: const EdgeInsets.symmetric(horizontal: AppSpacing.md, vertical: AppSpacing.sm),
            decoration: BoxDecoration(
              color: _saved ? AppColors.primary.withValues(alpha: 0.08) : Colors.transparent,
              border: Border.all(color: _saved ? AppColors.primary.withValues(alpha: 0.2) : Colors.transparent),
              borderRadius: BorderRadius.circular(AppRadius.md),
            ),
            child: Row(
              mainAxisSize: MainAxisSize.min,
              children: [
                Icon(_saved ? Icons.check : Icons.refresh, size: 14, color: _saved ? AppColors.primary : AppColors.textMuted),
                const SizedBox(width: 6),
                // Flexible (rather than a bare Text) -- "CHANGES AUTO-SAVED"
                // is a few px wider than the 256px nav column has spare
                // room for once the icon/padding/letter-spacing are
                // accounted for; this lets it elide instead of forcing a
                // hard RenderFlex overflow every time a field autosaves.
                Flexible(
                  child: Text(
                    (_saved ? "Changes Auto-Saved" : "Ready for Changes").toUpperCase(),
                    overflow: TextOverflow.ellipsis,
                    style: AppTypography.labelCaps.copyWith(
                      fontSize: 10,
                      color: _saved ? AppColors.primary : AppColors.textMuted,
                    ),
                  ),
                ),
              ],
            ),
          ),
          const SizedBox(height: AppSpacing.sm),
          TextButton.icon(
            onPressed: () => ConfirmationDialog.show(
              context,
              title: "Reset All Settings?",
              description:
                  "This will revert ALL global settings including AI Provider, Engine Parameters, "
                  "and Network Ingestion to their factory defaults. This action cannot be undone.",
              confirmText: "Reset Everything",
              variant: ConfirmationVariant.destructive,
              onConfirm: () => unawaited(_handleResetAll()),
            ),
            icon: const Icon(Icons.restart_alt, size: 16),
            label: const Text("Reset Settings"),
            style: TextButton.styleFrom(
              foregroundColor: AppColors.textMuted,
              alignment: Alignment.centerLeft,
            ),
          ),
          TextButton.icon(
            onPressed: () => ConfirmationDialog.show(
              context,
              title: "Total Factory Reset?",
              description:
                  "This is a Nuclear Option. It will permanently delete all workspaces, sources, "
                  "log databases, pattern caches, AI chat history, and settings. This action is "
                  "irreversible.",
              confirmText: "Wipe Everything",
              variant: ConfirmationVariant.destructive,
              onConfirm: () => unawaited(_handleFactoryReset()),
            ),
            icon: const Icon(Icons.delete_forever_outlined, size: 16),
            label: const Text("Factory Reset"),
            style: TextButton.styleFrom(
              foregroundColor: AppColors.error.withValues(alpha: 0.85),
              alignment: Alignment.centerLeft,
            ),
          ),
        ],
      ),
    );
  }

  // ── Section dispatch ─────────────────────────────────────────────────

  Widget _buildSection(AppSettings settings) {
    switch (_activeSection) {
      case _Section.ai:
        return _aiSection(settings);
      case _Section.drain:
        return _drainSection(settings);
      case _Section.ingestion:
        return _ingestionSection(settings);
      case _Section.general:
        return _generalSection(settings);
    }
  }

  Widget _sectionHeader(String title, String subtitle) {
    return Container(
      padding: const EdgeInsets.only(bottom: AppSpacing.md),
      margin: const EdgeInsets.only(bottom: AppSpacing.lg),
      decoration: const BoxDecoration(border: Border(bottom: BorderSide(color: AppColors.borderSubtle))),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Text(title, style: AppTypography.h1.copyWith(fontSize: 22)),
          const SizedBox(height: 4),
          Text(subtitle, style: AppTypography.body.copyWith(fontSize: 13, color: AppColors.textMuted)),
        ],
      ),
    );
  }

  Widget _fieldLabel(String text, {Widget? trailing}) {
    return Padding(
      padding: const EdgeInsets.only(bottom: 6),
      child: Row(
        mainAxisSize: MainAxisSize.min,
        children: [
          Text(text.toUpperCase(), style: AppTypography.labelCaps.copyWith(fontSize: 11)),
          if (trailing != null) ...[const SizedBox(width: 6), trailing],
        ],
      ),
    );
  }

  // ── AI section ─────────────────────────────────────────────────────

  static const Map<String, String> _kProviderLabels = {
    "gemini-cli": "Gemini CLI Integrated",
    "ollama": "Local Inference",
    "ai-studio": "Google Cloud Native",
    "lmstudio": "Local App Inference",
    "openai-compatible": "Universal API",
  };

  static const Map<String, String> _kProviderDescriptions = {
    "gemini-cli":
        "Runs purely on your local hardware via the configured gemini-cli. Zero data egress to "
        "third-party APIs beyond the model provider.",
    "ollama": "Ensure Ollama is running and desired model is pulled locally.",
    "ai-studio": "Connect directly to Google's model infrastructure via API Key.",
    "lmstudio": "LM Studio local server. Ensure the server is started in the LM Studio SDK tab.",
    "openai-compatible": "Supports Azure, Groq, Perplexity, or any OpenAI-compatible proxy.",
  };

  Widget _aiSection(AppSettings settings) {
    return Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        _sectionHeader("AI Intelligence", "Fine-tune the reasoning engine used to summarize and root-cause log clusters."),
        Row(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            Expanded(child: _providerField(settings)),
            const SizedBox(width: AppSpacing.lg),
            Expanded(child: _providerConnectionField(settings)),
          ],
        ),
        const SizedBox(height: AppSpacing.lg),
        Row(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            Expanded(child: _modelField(settings)),
            const SizedBox(width: AppSpacing.lg),
            Expanded(
              child: settings.aiProvider == "openai-compatible"
                  ? Column(
                      crossAxisAlignment: CrossAxisAlignment.start,
                      children: [
                        _fieldLabel("API Base URL"),
                        TextField(
                          controller: _openaiHostCtrl,
                          onChanged: (v) => _update({"ai_openai_host": v}),
                          decoration: const InputDecoration(isDense: true, hintText: "http://localhost:1234/v1"),
                        ),
                      ],
                    )
                  : const SizedBox.shrink(),
            ),
          ],
        ),
        const SizedBox(height: AppSpacing.lg),
        Container(
          padding: const EdgeInsets.all(AppSpacing.md),
          decoration: BoxDecoration(
            color: AppColors.primary.withValues(alpha: 0.05),
            borderRadius: BorderRadius.circular(AppRadius.lg),
            border: Border.all(color: AppColors.primary.withValues(alpha: 0.1)),
          ),
          child: Row(
            children: [
              const Icon(Icons.smart_toy_outlined, size: 18, color: AppColors.primary),
              const SizedBox(width: AppSpacing.sm),
              Expanded(
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    Text(
                      (_kProviderLabels[settings.aiProvider] ?? "Universal API").toUpperCase(),
                      style: AppTypography.labelCaps.copyWith(fontSize: 11, color: AppColors.primary),
                    ),
                    Text(
                      _kProviderDescriptions[settings.aiProvider] ?? _kProviderDescriptions["openai-compatible"]!,
                      style: AppTypography.body.copyWith(fontSize: 11, color: AppColors.textMuted),
                    ),
                  ],
                ),
              ),
            ],
          ),
        ),
        const SizedBox(height: AppSpacing.lg),
        _fieldLabel(
          "Dynamic System Prompt",
          trailing: const HelpTooltip(message: "Defines the persona and constraints for the AI specialist."),
        ),
        TextField(
          controller: _systemPromptCtrl,
          onChanged: (v) => _update({"ai_system_prompt": v}),
          minLines: 5,
          maxLines: 8,
          style: AppTypography.monoBody.copyWith(fontSize: 12),
        ),
        const SizedBox(height: AppSpacing.lg),
        InkWell(
          onTap: () => setState(() => _isToolsExpanded = !_isToolsExpanded),
          child: Row(
            children: [
              Expanded(child: _fieldLabel("Tools & Skills")),
              Icon(_isToolsExpanded ? Icons.expand_less : Icons.expand_more, size: 18, color: AppColors.textMuted),
            ],
          ),
        ),
        if (_isToolsExpanded) ...[
          const SizedBox(height: AppSpacing.sm),
          _toggleRow(
            title: "Enable Log Search Tool",
            desc: "Allow AI to autonomously search the DuckDB storage for error contexts.",
            value: settings.aiToolSearch,
            onChanged: (v) => _update({"ai_tool_search": v}),
          ),
          const SizedBox(height: AppSpacing.sm),
          _toggleRow(
            title: "Enable Associative Memory",
            desc: "Allow AI to save and autonomously retrieve past issue resolutions.",
            value: settings.aiToolMemory,
            onChanged: (v) => _update({"ai_tool_memory": v}),
          ),
        ],
        const SizedBox(height: AppSpacing.lg),
        _toggleRow(
          title: "Agentic MCP Server",
          desc: "Expose log analysis tools via SSE Port 5001 for external AI agents.",
          value: settings.mcpServerEnabled,
          onChanged: (v) => _update({"mcp_server_enabled": v}),
        ),
      ],
    );
  }

  Widget _providerField(AppSettings settings) {
    return Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        _fieldLabel("Model Provider"),
        DropdownButtonFormField<String>(
          initialValue: settings.aiProvider,
          items: const [
            DropdownMenuItem(value: "gemini-cli", child: Text("Gemini CLI")),
            DropdownMenuItem(value: "ollama", child: Text("Ollama")),
            DropdownMenuItem(value: "lmstudio", child: Text("LM Studio")),
            DropdownMenuItem(value: "ai-studio", child: Text("Gemini AI Studio")),
            DropdownMenuItem(value: "openai-compatible", child: Text("OpenAI Compatible")),
          ],
          onChanged: (v) {
            if (v == null) return;
            String newModel = settings.aiModel;
            switch (v) {
              case "ollama":
                newModel = "gemma4:e2b";
              case "gemini-cli":
                newModel = "flash";
              case "openai-compatible":
                newModel = "gpt-4o";
              case "ai-studio":
                newModel = "gemini-2.0-flash";
            }
            _update({"ai_provider": v, "ai_model": newModel});
          },
        ),
      ],
    );
  }

  Widget _providerConnectionField(AppSettings settings) {
    switch (settings.aiProvider) {
      case "gemini-cli":
        return _hostField(
          label: "A2A Server URL",
          controller: _geminiUrlCtrl,
          hint: "http://localhost:22436",
          helper: "Daemon port for Hot Mode.",
          onChanged: (v) => _update({"ai_gemini_url": v}),
          showTest: true,
        );
      case "ollama":
        return _hostField(
          label: "Ollama Server Host",
          controller: _ollamaHostCtrl,
          hint: "http://localhost:11434",
          helper: "Local Ollama instance URL.",
          onChanged: (v) => _update({"ai_ollama_host": v}),
          showTest: true,
        );
      case "lmstudio":
        return _hostField(
          label: "LM Studio Server Host",
          controller: _lmstudioHostCtrl,
          hint: "http://localhost:1234/v1",
          helper: "Local LM Studio API URL (usually port 1234).",
          onChanged: (v) => _update({"ai_lmstudio_host": v}),
          showTest: true,
        );
      case "ai-studio":
      case "openai-compatible":
        return Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            Row(
              children: [
                Expanded(child: _fieldLabel("Secret API Key")),
                TextButton(
                  onPressed: (_isTestingConnection || settings.aiApiKey.isEmpty) ? null : _handleTestConnection,
                  child: Text(_isTestingConnection ? "Testing..." : "Test Connection", style: const TextStyle(fontSize: 11)),
                ),
              ],
            ),
            TextField(
              controller: _apiKeyCtrl,
              obscureText: !_showApiKey,
              onChanged: (v) => _update({"ai_api_key": v}),
              decoration: InputDecoration(
                isDense: true,
                hintText: "sk-••••••••••••••••",
                suffixIcon: IconButton(
                  iconSize: 16,
                  icon: Icon(_showApiKey ? Icons.visibility_off : Icons.visibility),
                  onPressed: () => setState(() => _showApiKey = !_showApiKey),
                ),
              ),
            ),
            const SizedBox(height: 4),
            Text(
              "Keys are stored securely locally. Optional for some local engines.",
              style: AppTypography.body.copyWith(fontSize: 10, color: AppColors.textMuted),
            ),
          ],
        );
      default:
        return const SizedBox.shrink();
    }
  }

  Widget _hostField({
    required String label,
    required TextEditingController controller,
    required String hint,
    required String helper,
    required ValueChanged<String> onChanged,
    bool showTest = false,
  }) {
    return Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        Row(
          children: [
            Expanded(child: _fieldLabel(label)),
            if (showTest)
              TextButton(
                onPressed: _isTestingConnection ? null : _handleTestConnection,
                child: Text(_isTestingConnection ? "Testing..." : "Test Connection", style: const TextStyle(fontSize: 11)),
              ),
          ],
        ),
        TextField(
          controller: controller,
          onChanged: onChanged,
          decoration: InputDecoration(isDense: true, hintText: hint),
        ),
        const SizedBox(height: 4),
        Text(helper, style: AppTypography.body.copyWith(fontSize: 10, color: AppColors.textMuted)),
      ],
    );
  }

  Widget _modelField(AppSettings settings) {
    if (settings.aiProvider == "gemini-cli") {
      return Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          _fieldLabel("Gemini Model Strategy"),
          DropdownButtonFormField<String>(
            initialValue: settings.aiModel,
            items: const [
              DropdownMenuItem(value: "flash", child: Text("Flash")),
              DropdownMenuItem(value: "pro", child: Text("Pro")),
              DropdownMenuItem(value: "flash-lite", child: Text("Flash Lite")),
              DropdownMenuItem(value: "auto", child: Text("Auto")),
              DropdownMenuItem(value: "auto-gemini-3", child: Text("Auto Gemini 3")),
              DropdownMenuItem(value: "auto-gemini-2.5", child: Text("Auto Gemini 2.5")),
            ],
            onChanged: (v) {
              if (v != null) _update({"ai_model": v});
            },
          ),
        ],
      );
    }

    return Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        Row(
          children: [
            Expanded(child: _fieldLabel("Model")),
            if (_kDynamicModelProviders.contains(settings.aiProvider))
              TextButton(
                onPressed: _isFetchingModels
                    ? null
                    : () async {
                        setState(() => _isFetchingModels = true);
                        final models = await ref.read(settingsProvider.notifier).fetchAvailableModels();
                        if (!mounted) return;
                        setState(() {
                          _availableModels = models;
                          _isFetchingModels = false;
                        });
                      },
                child: Text(_isFetchingModels ? "Pulling..." : "Refresh List", style: const TextStyle(fontSize: 11)),
              ),
          ],
        ),
        if (_availableModels.isNotEmpty)
          DropdownButtonFormField<String>(
            initialValue: settings.aiModel,
            items: [
              if (!_availableModels.contains(settings.aiModel))
                DropdownMenuItem(value: settings.aiModel, child: Text(settings.aiModel)),
              for (final m in _availableModels) DropdownMenuItem(value: m, child: Text(m)),
            ],
            onChanged: (v) {
              if (v != null) _update({"ai_model": v});
            },
          )
        else
          Column(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              TextField(
                onChanged: (v) => _update({"ai_model": v}),
                controller: TextEditingController(text: settings.aiModel)
                  ..selection = TextSelection.collapsed(offset: settings.aiModel.length),
                decoration: const InputDecoration(isDense: true, hintText: "Enter model ID manually"),
              ),
              if (settings.aiProvider == "ollama")
                Padding(
                  padding: const EdgeInsets.only(top: 4),
                  child: Text(
                    "No models found. Ensure Ollama is running or enter ID manually.",
                    style: AppTypography.body.copyWith(fontSize: 10, color: AppColors.warning),
                  ),
                ),
            ],
          ),
      ],
    );
  }

  Widget _toggleRow({
    required String title,
    required String desc,
    required bool value,
    required ValueChanged<bool> onChanged,
  }) {
    return Container(
      padding: const EdgeInsets.all(AppSpacing.md),
      decoration: BoxDecoration(
        color: AppColors.bgSurface.withValues(alpha: 0.5),
        border: Border.all(color: AppColors.border),
        borderRadius: BorderRadius.circular(AppRadius.lg),
      ),
      child: Row(
        children: [
          Expanded(
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Text(title, style: AppTypography.body.copyWith(fontSize: 13, fontWeight: FontWeight.w700)),
                const SizedBox(height: 2),
                Text(desc, style: AppTypography.body.copyWith(fontSize: 10, color: AppColors.textMuted)),
              ],
            ),
          ),
          Switch(value: value, onChanged: onChanged),
        ],
      ),
    );
  }

  // ── Drain section ─────────────────────────────────────────────────

  Widget _drainSection(AppSettings settings) {
    return Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        _sectionHeader(
          "Global Core Engine (Drain3)",
          "System-wide defaults for log parsing, clustering, and pattern discovery.",
        ),
        Row(
          children: [
            Expanded(
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  _fieldLabel("Similarity"),
                  TextField(
                    controller: _drainSimCtrl,
                    keyboardType: const TextInputType.numberWithOptions(decimal: true),
                    onChanged: (v) {
                      final parsed = double.tryParse(v);
                      if (parsed != null) _update({"drain_similarity_threshold": parsed});
                    },
                  ),
                ],
              ),
            ),
            const SizedBox(width: AppSpacing.md),
            Expanded(
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  _fieldLabel("Branches"),
                  TextField(
                    controller: _drainChildrenCtrl,
                    keyboardType: TextInputType.number,
                    onChanged: (v) {
                      final parsed = int.tryParse(v);
                      if (parsed != null) _update({"drain_max_children": parsed});
                    },
                  ),
                ],
              ),
            ),
            const SizedBox(width: AppSpacing.md),
            Expanded(
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  _fieldLabel("Cluster Cap"),
                  TextField(
                    controller: _drainClustersCtrl,
                    keyboardType: TextInputType.number,
                    onChanged: (v) {
                      final parsed = int.tryParse(v);
                      if (parsed != null) _update({"drain_max_clusters": parsed});
                    },
                  ),
                ],
              ),
            ),
          ],
        ),
        const SizedBox(height: AppSpacing.md),
        Container(
          padding: const EdgeInsets.all(AppSpacing.md),
          decoration: BoxDecoration(
            color: AppColors.bgSurface.withValues(alpha: 0.5),
            borderRadius: BorderRadius.circular(AppRadius.lg),
            border: Border.all(color: AppColors.border),
          ),
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              Row(
                mainAxisAlignment: MainAxisAlignment.spaceBetween,
                children: [
                  Text("PERMISSIVE", style: AppTypography.labelCaps.copyWith(fontSize: 10)),
                  Text(
                    "${(settings.drainSimilarityThreshold * 100).toStringAsFixed(0)}% Sensitivity",
                    style: AppTypography.body.copyWith(fontSize: 13, color: AppColors.primary, fontWeight: FontWeight.w700),
                  ),
                  Text("STRICT", style: AppTypography.labelCaps.copyWith(fontSize: 10)),
                ],
              ),
              Slider(
                value: settings.drainSimilarityThreshold.clamp(0.0, 1.0),
                min: 0,
                max: 1,
                divisions: 100,
                onChanged: (v) => _update({"drain_similarity_threshold": v}),
              ),
              Text(
                "The similarity threshold determines how 'close' two log lines must be to share a "
                "template. Lower values 0.1-0.4 are better for high-variance logs.",
                style: AppTypography.body.copyWith(fontSize: 10, color: AppColors.textMuted),
              ),
            ],
          ),
        ),
        const SizedBox(height: AppSpacing.lg),
        Row(
          children: [
            Expanded(child: _fieldLabel("Variable Masking")),
            TextButton.icon(
              onPressed: () {
                ref.read(settingsProvider.notifier).setDrainMasks(
                  AppSettings.defaults.drainMasks,
                  workspaceId: widget.workspaceId,
                );
                _showSnack("Variable masking reset to standard heuristics");
              },
              icon: const Icon(Icons.restart_alt, size: 14),
              label: const Text("Reset to Standard", style: TextStyle(fontSize: 10)),
            ),
          ],
        ),
        Text(
          "Sanitize logs by replacing dynamic variables like IPs or IDs with tokens before clustering.",
          style: AppTypography.body.copyWith(fontSize: 10, color: AppColors.textMuted),
        ),
        const SizedBox(height: AppSpacing.sm),
        Container(
          padding: const EdgeInsets.all(AppSpacing.sm),
          decoration: BoxDecoration(
            color: AppColors.primary.withValues(alpha: 0.05),
            border: Border.all(color: AppColors.primary.withValues(alpha: 0.2)),
            borderRadius: BorderRadius.circular(AppRadius.md),
          ),
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              Text("STANDARD SYSTEM HEURISTICS", style: AppTypography.labelCaps.copyWith(fontSize: 10, color: AppColors.primary)),
              const SizedBox(height: 4),
              Text("IP ADDRESS -- IPv4 / IPv6 Formats", style: AppTypography.log.copyWith(fontSize: 10, color: AppColors.textMuted)),
              Text("UUID / GUID -- Standard 36-char markers", style: AppTypography.log.copyWith(fontSize: 10, color: AppColors.textMuted)),
            ],
          ),
        ),
        const SizedBox(height: AppSpacing.sm),
        for (var i = 0; i < settings.drainMasks.length; i++) _maskRow(settings.drainMasks, i),
        OutlinedButton.icon(
          onPressed: () {
            ref.read(settingsProvider.notifier).setDrainMasks([
              ...settings.drainMasks,
              const DrainMask(label: "NEW_MASK", pattern: "", enabled: true),
            ], workspaceId: widget.workspaceId);
          },
          icon: const Icon(Icons.add, size: 14),
          label: const Text("Add Custom Masking Instruction", style: TextStyle(fontSize: 11)),
        ),
        const SizedBox(height: AppSpacing.lg),
        Container(
          padding: const EdgeInsets.all(AppSpacing.md),
          decoration: BoxDecoration(
            color: AppColors.error.withValues(alpha: 0.05),
            border: Border.all(color: AppColors.error.withValues(alpha: 0.1)),
            borderRadius: BorderRadius.circular(AppRadius.lg),
          ),
          child: Row(
            children: [
              Expanded(
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    Text("Pattern Memory", style: AppTypography.body.copyWith(fontSize: 13, fontWeight: FontWeight.w700, color: AppColors.error)),
                    Text(
                      "Clearing patterns will force the engine to re-learn log templates from scratch. "
                      "This does not affect your masking rules.",
                      style: AppTypography.body.copyWith(fontSize: 10, color: AppColors.textMuted),
                    ),
                  ],
                ),
              ),
              OutlinedButton.icon(
                onPressed: () => ConfirmationDialog.show(
                  context,
                  title: "Clear Pattern Memory?",
                  description:
                      "This will force the engine to re-learn log templates from scratch. Your masking "
                      "rules and settings will be preserved.",
                  confirmText: "Clear Patterns",
                  variant: ConfirmationVariant.destructive,
                  onConfirm: () => unawaited(_handleResetPatterns()),
                ),
                icon: const Icon(Icons.refresh, size: 14, color: AppColors.error),
                label: const Text("Clear Pattern Cache", style: TextStyle(fontSize: 11, color: AppColors.error)),
              ),
            ],
          ),
        ),
        const SizedBox(height: AppSpacing.lg),
        _toggleRow(
          title: "Auto-Detect Timestamps",
          desc: "Scan log messages automatically for standard date formats (ISO, Apache, Syslog, etc.).",
          value: settings.timestampAutoDetect,
          onChanged: (v) => _update({"timestamp_auto_detect": v}),
        ),
        const SizedBox(height: AppSpacing.md),
        Row(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            Expanded(
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  _fieldLabel("Custom Timestamp Regex"),
                  TextField(
                    controller: _tsRegexCtrl,
                    onChanged: (v) => _update({"timestamp_custom_regex": v}),
                    style: AppTypography.monoBody.copyWith(fontSize: 12),
                    decoration: const InputDecoration(isDense: true, hintText: r"^\[(?P<timestamp>[^\]]+)\]"),
                  ),
                ],
              ),
            ),
            const SizedBox(width: AppSpacing.md),
            Expanded(
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  _fieldLabel("Custom Timestamp Format"),
                  TextField(
                    controller: _tsFormatCtrl,
                    onChanged: (v) => _update({"timestamp_custom_format": v}),
                    style: AppTypography.monoBody.copyWith(fontSize: 12),
                    decoration: const InputDecoration(isDense: true, hintText: "%d/%b/%Y:%H:%M:%S"),
                  ),
                ],
              ),
            ),
          ],
        ),
        const SizedBox(height: AppSpacing.lg),
        FacetExtractionSettings(
          rules: settings.facetExtractions,
          title: "Global Extraction Rules",
          onChange: (rules) =>
              ref.read(settingsProvider.notifier).setFacetExtractions(rules, workspaceId: widget.workspaceId),
        ),
      ],
    );
  }

  Widget _maskRow(List<DrainMask> masks, int index) {
    final mask = masks[index];
    void replace(DrainMask next) {
      final updated = [...masks];
      updated[index] = next;
      ref.read(settingsProvider.notifier).setDrainMasks(updated, workspaceId: widget.workspaceId);
    }

    return Container(
      margin: const EdgeInsets.only(bottom: 6),
      padding: const EdgeInsets.symmetric(horizontal: AppSpacing.sm, vertical: 4),
      decoration: BoxDecoration(
        color: AppColors.bgSurface.withValues(alpha: 0.3),
        border: Border.all(color: AppColors.border),
        borderRadius: BorderRadius.circular(AppRadius.lg),
      ),
      child: Row(
        children: [
          Switch(
            value: mask.enabled,
            onChanged: (v) => replace(DrainMask(label: mask.label, pattern: mask.pattern, enabled: v)),
          ),
          Expanded(
            flex: 2,
            child: TextField(
              controller: TextEditingController(text: mask.label)
                ..selection = TextSelection.collapsed(offset: mask.label.length),
              onChanged: (v) => replace(DrainMask(label: v, pattern: mask.pattern, enabled: mask.enabled)),
              style: AppTypography.body.copyWith(fontSize: 11, fontWeight: FontWeight.w700, color: AppColors.primary),
              decoration: const InputDecoration(isDense: true, border: InputBorder.none, hintText: "LABEL"),
            ),
          ),
          Expanded(
            flex: 4,
            child: TextField(
              controller: TextEditingController(text: mask.pattern)
                ..selection = TextSelection.collapsed(offset: mask.pattern.length),
              onChanged: (v) => replace(DrainMask(label: mask.label, pattern: v, enabled: mask.enabled)),
              style: AppTypography.monoBody.copyWith(fontSize: 11),
              decoration: const InputDecoration(isDense: true, border: InputBorder.none, hintText: "Regex Pattern"),
            ),
          ),
          IconButton(
            iconSize: 16,
            icon: const Icon(Icons.delete_outline, color: AppColors.textMuted),
            onPressed: () {
              final updated = [...masks]..removeAt(index);
              ref.read(settingsProvider.notifier).setDrainMasks(updated, workspaceId: widget.workspaceId);
            },
          ),
        ],
      ),
    );
  }

  // ── Ingestion section ─────────────────────────────────────────────

  Widget _ingestionSection(AppSettings settings) {
    return Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        _sectionHeader("Network Ingestion", "Listen for live log streams from external servers via common protocols."),
        _ingestionRow(
          icon: Icons.terminal,
          title: "Syslog UDP Listener",
          desc: "Accept logs from Linux/Unix servers using standard syslog format.",
          portLabel: "UDP Port",
          portController: _syslogPortCtrl,
          enabled: settings.ingestionSyslogEnabled,
          onPortChanged: (v) {
            final parsed = int.tryParse(v);
            if (parsed != null) _update({"ingestion_syslog_port": parsed});
          },
          onEnabledChanged: (v) => _update({"ingestion_syslog_enabled": v}),
        ),
        const SizedBox(height: AppSpacing.md),
        _ingestionRow(
          icon: Icons.hub_outlined,
          title: "HTTP Ingestion API",
          desc: "Ingest logs via POST requests to /ingest using JSON payloads.",
          portLabel: "TCP Port",
          portController: _httpPortCtrl,
          enabled: settings.ingestionHttpEnabled,
          onPortChanged: (v) {
            final parsed = int.tryParse(v);
            if (parsed != null) _update({"ingestion_http_port": parsed});
          },
          onEnabledChanged: (v) => _update({"ingestion_http_enabled": v}),
        ),
        const SizedBox(height: AppSpacing.lg),
        Container(
          padding: const EdgeInsets.all(AppSpacing.md),
          decoration: BoxDecoration(
            color: AppColors.primary.withValues(alpha: 0.05),
            borderRadius: BorderRadius.circular(AppRadius.lg),
            border: Border.all(color: AppColors.primary.withValues(alpha: 0.1)),
          ),
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              Text("ROUTING INSTRUCTIONS", style: AppTypography.labelCaps.copyWith(fontSize: 11, color: AppColors.primary)),
              const SizedBox(height: 6),
              Text(
                "To route logs to a specific workspace and collection, use the path:\n"
                "POST http://localhost:${settings.ingestionHttpPort}/ingest/my-workspace/my-collection\n\n"
                "Or use query parameters:\n"
                "/ingest?ws=my-workspace&source_id=my-collection",
                style: AppTypography.log.copyWith(fontSize: 11, color: AppColors.textSecondary),
              ),
            ],
          ),
        ),
      ],
    );
  }

  Widget _ingestionRow({
    required IconData icon,
    required String title,
    required String desc,
    required String portLabel,
    required TextEditingController portController,
    required bool enabled,
    required ValueChanged<String> onPortChanged,
    required ValueChanged<bool> onEnabledChanged,
  }) {
    return Container(
      padding: const EdgeInsets.all(AppSpacing.md),
      decoration: BoxDecoration(
        color: AppColors.bgSurface.withValues(alpha: 0.5),
        border: Border.all(color: AppColors.border),
        borderRadius: BorderRadius.circular(AppRadius.lg),
      ),
      child: Row(
        children: [
          Icon(icon, size: 20, color: AppColors.primary),
          const SizedBox(width: AppSpacing.sm),
          Expanded(
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Text(title, style: AppTypography.body.copyWith(fontSize: 13, fontWeight: FontWeight.w700)),
                Text(desc, style: AppTypography.body.copyWith(fontSize: 10, color: AppColors.textMuted)),
              ],
            ),
          ),
          Column(
            crossAxisAlignment: CrossAxisAlignment.end,
            children: [
              Text(portLabel.toUpperCase(), style: AppTypography.labelCaps.copyWith(fontSize: 9)),
              SizedBox(
                width: 72,
                height: 30,
                child: TextField(
                  controller: portController,
                  keyboardType: TextInputType.number,
                  textAlign: TextAlign.center,
                  onChanged: onPortChanged,
                  decoration: const InputDecoration(isDense: true, contentPadding: EdgeInsets.symmetric(vertical: 4)),
                ),
              ),
            ],
          ),
          const SizedBox(width: AppSpacing.md),
          Switch(value: enabled, onChanged: onEnabledChanged),
        ],
      ),
    );
  }

  // ── General section ────────────────────────────────────────────────

  Widget _generalSection(AppSettings settings) {
    return Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        _sectionHeader("Interface", "Accessibility and display preferences for your workspace."),
        Row(
          children: [
            Expanded(
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  _fieldLabel("Row Density"),
                  DropdownButtonFormField<String>(
                    initialValue: settings.uiRowHeight,
                    items: const [
                      DropdownMenuItem(value: "28px", child: Text("Ultra Compact")),
                      DropdownMenuItem(value: "36px", child: Text("Balanced")),
                      DropdownMenuItem(value: "44px", child: Text("Comfortable")),
                    ],
                    onChanged: (v) {
                      if (v != null) _update({"ui_row_height": v});
                    },
                  ),
                ],
              ),
            ),
            const SizedBox(width: AppSpacing.lg),
            Expanded(
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  _fieldLabel("Reading Size"),
                  DropdownButtonFormField<String>(
                    initialValue: settings.uiFontSize,
                    items: const [
                      DropdownMenuItem(value: "12px", child: Text("12px -- Minimal")),
                      DropdownMenuItem(value: "13px", child: Text("13px -- Optimized")),
                      DropdownMenuItem(value: "14px", child: Text("14px")),
                      DropdownMenuItem(value: "16px", child: Text("16px -- Enhanced")),
                    ],
                    onChanged: (v) {
                      if (v != null) _update({"ui_font_size": v});
                    },
                  ),
                ],
              ),
            ),
          ],
        ),
        const SizedBox(height: AppSpacing.lg),
        Container(
          padding: const EdgeInsets.all(AppSpacing.md),
          decoration: BoxDecoration(
            border: Border.all(color: AppColors.border),
            borderRadius: BorderRadius.circular(AppRadius.lg),
          ),
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              Text("LIVE TYPOGRAPHY PREVIEW", style: AppTypography.labelCaps.copyWith(fontSize: 10)),
              const SizedBox(height: AppSpacing.sm),
              Container(
                padding: const EdgeInsets.all(AppSpacing.sm),
                decoration: BoxDecoration(
                  color: AppColors.bgBase.withValues(alpha: 0.8),
                  borderRadius: BorderRadius.circular(AppRadius.md),
                ),
                child: RichText(
                  text: TextSpan(
                    style: AppTypography.log.copyWith(
                      fontSize: double.tryParse(settings.uiFontSize.replaceAll("px", "")) ?? 13,
                    ),
                    children: [
                      TextSpan(text: "Mar 27 16:45:01 ", style: const TextStyle(color: AppColors.textMuted)),
                      const TextSpan(
                        text: " CRITICAL ",
                        style: TextStyle(color: AppColors.error, fontWeight: FontWeight.w700),
                      ),
                      const TextSpan(
                        text: " Worker[4] lost quorum connectivity to peer-93. Re-electing...",
                        style: TextStyle(color: AppColors.textPrimary),
                      ),
                    ],
                  ),
                ),
              ),
            ],
          ),
        ),
        const SizedBox(height: AppSpacing.xl),
        Text("Keyboard Shortcuts", style: AppTypography.h2),
        const SizedBox(height: 4),
        Text(
          "Customize global key bindings for faster navigation.",
          style: AppTypography.body.copyWith(fontSize: 10, color: AppColors.textMuted),
        ),
        const SizedBox(height: AppSpacing.md),
        Container(
          padding: const EdgeInsets.all(AppSpacing.md),
          decoration: BoxDecoration(
            color: AppColors.bgSurface.withValues(alpha: 0.5),
            border: Border.all(color: AppColors.border),
            borderRadius: BorderRadius.circular(AppRadius.lg),
          ),
          child: Row(
            children: [
              Expanded(
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    Text("Command Palette", style: AppTypography.body.copyWith(fontSize: 13, fontWeight: FontWeight.w700)),
                    Text(
                      "Quickly navigate workspaces and sources.",
                      style: AppTypography.body.copyWith(fontSize: 10, color: AppColors.textMuted),
                    ),
                  ],
                ),
              ),
              _ShortcutCapture(
                value: settings.uiCommandPaletteShortcut,
                onChanged: (shortcut) => ref
                    .read(settingsProvider.notifier)
                    .setCommandPaletteShortcut(shortcut, workspaceId: widget.workspaceId),
              ),
            ],
          ),
        ),
      ],
    );
  }
}

class _NavButton extends StatelessWidget {
  const _NavButton({
    required this.icon,
    required this.label,
    required this.desc,
    required this.active,
    required this.onTap,
  });

  final IconData icon;
  final String label;
  final String desc;
  final bool active;
  final VoidCallback onTap;

  @override
  Widget build(BuildContext context) {
    return Material(
      color: active ? AppColors.primary.withValues(alpha: 0.1) : Colors.transparent,
      borderRadius: BorderRadius.circular(AppRadius.lg),
      child: InkWell(
        onTap: onTap,
        borderRadius: BorderRadius.circular(AppRadius.lg),
        child: Container(
          padding: const EdgeInsets.symmetric(horizontal: AppSpacing.md, vertical: AppSpacing.sm + 4),
          decoration: BoxDecoration(
            border: Border.all(color: active ? AppColors.primary.withValues(alpha: 0.2) : Colors.transparent),
            borderRadius: BorderRadius.circular(AppRadius.lg),
          ),
          child: Row(
            children: [
              Icon(icon, size: 18, color: active ? AppColors.primary : AppColors.textSecondary),
              const SizedBox(width: AppSpacing.sm),
              Expanded(
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    Text(
                      label,
                      style: AppTypography.body.copyWith(
                        fontSize: 13,
                        fontWeight: FontWeight.w600,
                        color: active ? AppColors.primary : AppColors.textPrimary,
                      ),
                    ),
                    Text(desc, style: AppTypography.body.copyWith(fontSize: 10, color: AppColors.textMuted)),
                  ],
                ),
              ),
            ],
          ),
        ),
      ),
    );
  }
}

/// Port of `SettingsPanel.tsx`'s inline `ShortcutCapture` component: records
/// the next key combination pressed while "recording" and reports it as a
/// [KeyboardShortcut]. Uses a [Focus] widget's key-event callback (capture
/// phase) instead of a DOM `window.addEventListener("keydown", ..., true)`.
class _ShortcutCapture extends StatefulWidget {
  const _ShortcutCapture({required this.value, required this.onChanged});

  final KeyboardShortcut value;
  final ValueChanged<KeyboardShortcut> onChanged;

  @override
  State<_ShortcutCapture> createState() => _ShortcutCaptureState();
}

class _ShortcutCaptureState extends State<_ShortcutCapture> {
  bool _recording = false;
  final _focusNode = FocusNode(debugLabel: "shortcut-capture");

  static final _kModifierKeys = {
    LogicalKeyboardKey.controlLeft,
    LogicalKeyboardKey.controlRight,
    LogicalKeyboardKey.altLeft,
    LogicalKeyboardKey.altRight,
    LogicalKeyboardKey.shiftLeft,
    LogicalKeyboardKey.shiftRight,
    LogicalKeyboardKey.metaLeft,
    LogicalKeyboardKey.metaRight,
  };

  @override
  void dispose() {
    _focusNode.dispose();
    super.dispose();
  }

  String get _display {
    if (widget.value.key.isEmpty) return "None";
    final parts = <String>[];
    if (widget.value.ctrl) parts.add("Ctrl");
    if (widget.value.alt) parts.add("Alt");
    if (widget.value.shift) parts.add("Shift");
    if (widget.value.meta) parts.add("Win/Cmd");
    parts.add(widget.value.key.toUpperCase());
    return parts.join(" + ");
  }

  KeyEventResult _handleKey(FocusNode node, KeyEvent event) {
    if (!_recording || event is! KeyDownEvent) return KeyEventResult.ignored;
    if (event.logicalKey == LogicalKeyboardKey.escape) {
      setState(() => _recording = false);
      return KeyEventResult.handled;
    }
    if (_kModifierKeys.contains(event.logicalKey)) return KeyEventResult.handled;

    final keyLabel = event.logicalKey.keyLabel.toLowerCase();
    widget.onChanged(
      KeyboardShortcut(
        key: keyLabel,
        ctrl: HardwareKeyboard.instance.isControlPressed,
        alt: HardwareKeyboard.instance.isAltPressed,
        shift: HardwareKeyboard.instance.isShiftPressed,
        meta: HardwareKeyboard.instance.isMetaPressed,
      ),
    );
    setState(() => _recording = false);
    return KeyEventResult.handled;
  }

  @override
  Widget build(BuildContext context) {
    return Row(
      mainAxisSize: MainAxisSize.min,
      children: [
        Container(
          constraints: const BoxConstraints(minWidth: 140),
          height: 36,
          padding: const EdgeInsets.symmetric(horizontal: AppSpacing.md),
          alignment: Alignment.center,
          decoration: BoxDecoration(
            color: _recording ? AppColors.primary.withValues(alpha: 0.15) : AppColors.bgSurface,
            border: Border.all(color: _recording ? AppColors.primary : AppColors.border),
            borderRadius: BorderRadius.circular(AppRadius.xl),
          ),
          child: Text(
            _recording ? "Press Any Key" : _display,
            style: AppTypography.monoBody.copyWith(fontSize: 13),
          ),
        ),
        const SizedBox(width: AppSpacing.sm),
        Focus(
          focusNode: _focusNode,
          onKeyEvent: _handleKey,
          child: OutlinedButton(
            onPressed: () {
              setState(() => _recording = !_recording);
              if (_recording) _focusNode.requestFocus();
            },
            style: OutlinedButton.styleFrom(
              foregroundColor: _recording ? AppColors.error : null,
              side: _recording ? const BorderSide(color: AppColors.error) : null,
            ),
            child: Text(_recording ? "Cancel (Esc)" : "Change Shortcut", style: const TextStyle(fontSize: 11)),
          ),
        ),
      ],
    );
  }
}
