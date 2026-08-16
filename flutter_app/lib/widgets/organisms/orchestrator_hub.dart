/// Dart port of `src/components/organisms/OrchestratorHub.tsx`.
///
/// Right-docked drawer for the Investigation page's "Orchestrate" action: a
/// picker of quick toggles (Log Distribution / Anomaly Radar visualizers,
/// workspace-global AI context, clustering enable/pause, a link to Drain3
/// engine settings) plus two multi-step flows -- "Log Fusion" (build/edit a
/// named multi-source fusion stream) and "Temporal Sync" (per-source clock
/// offset calibration).
///
/// Distinct from [FusionConfigEngine] (`fusion_config_engine.dart`): that
/// widget is a full-page panel managing the single implicit per-workspace
/// fusion config (no name, no id). This widget manages zero-or-more *named*
/// fusions (`fusion_id` + `fusion_name`, created via the "Log Fusion"
/// strategy card) as one of several orchestration tools in a slide-over
/// drawer, matching the React source's `OrchestratorHub.tsx` scope.
///
/// Deviations from the React source:
///  - RPC calls (`get_fusion_config`/`update_fusion_config`/`get_templates`/
///    `get_temporal_offsets`/`update_temporal_offsets`) go through
///    [WorkspaceNotifier]'s additive methods (added ahead of this widget in
///    an earlier pass over `workspace_provider.dart`, see the "Fusion /
///    temporal-sync (OrchestratorHub)" section there) rather than a new
///    dedicated service provider -- these are explicitly `fusion_id`-scoped,
///    unlike [FusionConfigEngine]'s single-fusion-per-workspace
///    `fusionConfigServiceProvider`.
///  - The React version lazy-loads `CustomParserModal`/`TimeShiftModal` via
///    `React.lazy`+`Suspense` and renders them through `createPortal`. This
///    port has no lazy-loading concept (Dart compiles everything ahead of
///    time) and instead launches both as full-screen `showGeneralDialog`
///    routes -- [CustomParserModal] already renders its own full-bleed
///    backdrop, and [TimeShiftModal.show] already wraps itself in a
///    dialog-based `showDialog` call, so both compose directly with
///    `Navigator.of(context).pop()` closing them.
///  - The drawer is exposed as a plain `isOpen`/`onClose`-driven widget
///    (embed as the last child of a `Stack` for an always-mounted overlay,
///    matching [SystemDiagnosticConsole]'s convention) plus a static
///    [OrchestratorHub.show] convenience that pushes it as a right-slide-in
///    `showGeneralDialog` route, mirroring [TimeShiftModal]'s established
///    `.show()` pattern in this batch.
library;

import "dart:async";

import "package:flutter/material.dart";
import "package:flutter_riverpod/flutter_riverpod.dart";

import "../../models/fusion_config.dart";
import "../../models/template.dart";
import "../../models/workspace.dart";
import "../../providers/clustering_provider.dart";
import "../../providers/investigation_provider.dart";
import "../../providers/workspace_provider.dart";
import "../../theme/app_theme.dart";
import "custom_parser_modal.dart";
import "time_shift_modal.dart";

/// Fired once a fusion has been deployed, mirroring the React
/// `onFusionSaved: (fusionId, fusionName, configs) => void` prop. `configs`
/// is the raw wire-shape list ([FusionSourceConfig.toJson] per entry) so
/// callers don't need to depend on this widget's internal model choice.
typedef FusionSavedCallback =
    void Function(String fusionId, String fusionName, List<Map<String, dynamic>> configs);

enum _View { picker, fusionForm, aiContextForm, timeAlignmentForm }

class OrchestratorHub extends ConsumerStatefulWidget {
  const OrchestratorHub({
    super.key,
    required this.isOpen,
    required this.onClose,
    required this.workspaceId,
    required this.availableSources,
    required this.onFusionSaved,
    this.editingFusionId,
    this.editingFusionName,
    this.onEngineSettingsOpen,
  });

  final bool isOpen;
  final VoidCallback onClose;
  final String workspaceId;
  final List<LogSource> availableSources;
  final FusionSavedCallback onFusionSaved;

  /// Non-null when re-opening the drawer to edit an already-deployed fusion
  /// (skips straight to the fusion-form view and loads its saved config).
  final String? editingFusionId;
  final String? editingFusionName;

  final VoidCallback? onEngineSettingsOpen;

  /// Convenience wrapper matching this batch's other `.show()` dialog
  /// helpers -- pushes the drawer as a right-slide-in route via
  /// [showGeneralDialog] and pops it on close.
  static Future<void> show(
    BuildContext context, {
    required String workspaceId,
    required List<LogSource> availableSources,
    required FusionSavedCallback onFusionSaved,
    String? editingFusionId,
    String? editingFusionName,
    VoidCallback? onEngineSettingsOpen,
  }) {
    return showGeneralDialog<void>(
      context: context,
      barrierLabel: "Orchestrator",
      barrierDismissible: true,
      barrierColor: Colors.black.withValues(alpha: 0.4),
      transitionDuration: const Duration(milliseconds: 250),
      pageBuilder: (context, animation, secondaryAnimation) {
        return Align(
          alignment: Alignment.centerRight,
          child: SizedBox(
            width: 380,
            height: double.infinity,
            child: OrchestratorHub(
              isOpen: true,
              onClose: () => Navigator.of(context).pop(),
              workspaceId: workspaceId,
              availableSources: availableSources,
              onFusionSaved: onFusionSaved,
              editingFusionId: editingFusionId,
              editingFusionName: editingFusionName,
              onEngineSettingsOpen: onEngineSettingsOpen,
            ),
          ),
        );
      },
      transitionBuilder: (context, animation, secondaryAnimation, child) {
        final offset = Tween<Offset>(
          begin: const Offset(1, 0),
          end: Offset.zero,
        ).animate(CurvedAnimation(parent: animation, curve: Curves.easeOutCubic));
        return SlideTransition(position: offset, child: child);
      },
    );
  }

  @override
  ConsumerState<OrchestratorHub> createState() => _OrchestratorHubState();
}

class _OrchestratorHubState extends ConsumerState<OrchestratorHub> {
  _View _view = _View.picker;
  final _fusionNameController = TextEditingController();
  final _contextController = TextEditingController();
  List<FusionSourceConfig> _configs = const [];
  Map<String, int> _temporalOffsets = const {};
  bool _isSaving = false;
  bool _isLoadingConfig = false;
  List<Template> _templates = const [];

  @override
  void initState() {
    super.initState();
    if (widget.isOpen) {
      unawaited(_onOpen());
    }
  }

  @override
  void didUpdateWidget(covariant OrchestratorHub oldWidget) {
    super.didUpdateWidget(oldWidget);
    if (widget.isOpen && !oldWidget.isOpen) {
      unawaited(_onOpen());
    } else if (!widget.isOpen && oldWidget.isOpen) {
      setState(() => _view = _View.picker);
    }
  }

  @override
  void dispose() {
    _fusionNameController.dispose();
    _contextController.dispose();
    super.dispose();
  }

  void _showSnack(String message) {
    if (!mounted) return;
    ScaffoldMessenger.of(context).showSnackBar(SnackBar(content: Text(message)));
  }

  Future<void> _onOpen() async {
    unawaited(ref.read(clusteringProvider.notifier).fetchStatus(workspaceId: widget.workspaceId));

    final editingFusionId = widget.editingFusionId;
    if (editingFusionId != null) {
      _fusionNameController.text = widget.editingFusionName ?? "";
      setState(() {
        _view = _View.fusionForm;
        _isLoadingConfig = true;
      });
      try {
        final res = await ref
            .read(workspaceProvider.notifier)
            .getFusionConfig(widget.workspaceId, editingFusionId);
        final list = res["sources"] as List<dynamic>? ?? const [];
        if (!mounted) return;
        setState(() {
          _configs = list
              .map((s) => FusionSourceConfig.fromJson(s as Map<String, dynamic>))
              .toList();
        });
      } catch (_) {
        // Mirror TS: log-and-continue on fetch failure.
      } finally {
        if (mounted) setState(() => _isLoadingConfig = false);
      }
    } else {
      _fusionNameController.text = "";
      setState(() {
        _view = _View.picker;
        _configs = [
          for (final s in widget.availableSources)
            FusionSourceConfig(sourceId: s.path, enabled: false, tzOffset: 0),
        ];
      });
    }

    try {
      final raw = await ref.read(workspaceProvider.notifier).getTemplates(widget.workspaceId);
      if (!mounted) return;
      setState(() => _templates = raw.map(Template.fromJson).toList());
    } catch (_) {
      // Mirror TS: log-and-continue.
    }

    try {
      final offsets = await ref
          .read(workspaceProvider.notifier)
          .getTemporalOffsets(widget.workspaceId);
      if (!mounted) return;
      setState(() {
        _temporalOffsets = {
          for (final entry in offsets.entries) entry.key: (entry.value as num?)?.toInt() ?? 0,
        };
      });
    } catch (_) {
      // Mirror TS: log-and-continue.
    }
  }

  String _labelFor(String sourceId) {
    final match = widget.availableSources.where((s) => s.path == sourceId);
    if (match.isNotEmpty) return match.first.name;
    final parts = sourceId.split(RegExp(r"[\\/]"));
    return parts.isNotEmpty && parts.last.isNotEmpty ? parts.last : sourceId;
  }

  void _toggleSource(String sourceId) {
    setState(() {
      _configs = [
        for (final c in _configs)
          if (c.sourceId == sourceId) c.copyWith(enabled: !c.enabled) else c,
      ];
    });
  }

  void _applyTemplateToSource(String sourceId, String templateId) {
    final matches = _templates.where((t) => t.id.toString() == templateId);
    if (matches.isEmpty) return;
    final template = matches.first;
    setState(() {
      _configs = [
        for (final c in _configs)
          if (c.sourceId == sourceId) c.copyWith(parserConfig: template.config) else c,
      ];
    });
    _showSnack('Applied "${template.name}" to source.');
  }

  void _handleParserSaved(String sourceId, String configJson) {
    setState(() {
      _configs = [
        for (final c in _configs)
          if (c.sourceId == sourceId) c.copyWith(parserConfig: configJson) else c,
      ];
    });
  }

  void _openParserModal(String sourceId) {
    final matches = _configs.where((c) => c.sourceId == sourceId);
    final initialConfig = matches.isNotEmpty ? matches.first.parserConfig : null;
    showGeneralDialog<void>(
      context: context,
      barrierLabel: "Extraction Parser",
      barrierColor: Colors.transparent,
      pageBuilder: (dialogContext, animation, secondaryAnimation) {
        return CustomParserModal(
          workspaceId: widget.workspaceId,
          sourceId: sourceId,
          isOpen: true,
          onClose: () => Navigator.of(dialogContext).pop(),
          initialConfig: initialConfig,
          onSaved: (cfg) {
            _handleParserSaved(sourceId, cfg);
            Navigator.of(dialogContext).pop();
          },
        );
      },
    );
  }

  void _openTimeShift(LogSource source) {
    final offset = _temporalOffsets[source.path] ?? 0;
    TimeShiftModal.show(
      context,
      sourceLabel: source.name,
      initialShiftSeconds: offset,
      onSaved: (secs) {
        setState(() {
          _temporalOffsets = {..._temporalOffsets, source.path: secs};
        });
      },
    );
  }

  Future<void> _saveTemporalOffsets() async {
    setState(() => _isSaving = true);
    try {
      await ref
          .read(workspaceProvider.notifier)
          .updateTemporalOffsets(widget.workspaceId, _temporalOffsets);
      _showSnack("Temporal offsets calibrated.");
      if (mounted) setState(() => _view = _View.picker);
    } catch (_) {
      _showSnack("Failed to calibrate temporal offsets.");
    } finally {
      if (mounted) setState(() => _isSaving = false);
    }
  }

  Future<void> _deployFusion() async {
    final enabledCount = _configs.where((c) => c.enabled).length;
    if (enabledCount < 2) {
      _showSnack("Enable at least 2 log streams for fusion.");
      return;
    }

    setState(() => _isSaving = true);
    final fusionId = widget.editingFusionId ?? "fusion_${DateTime.now().millisecondsSinceEpoch}";
    final fusionName = _fusionNameController.text.trim().isEmpty
        ? "Log Fusion"
        : _fusionNameController.text.trim();
    final payload = _configs.map((c) => c.toJson()).toList();
    try {
      await ref
          .read(workspaceProvider.notifier)
          .updateFusionConfig(widget.workspaceId, fusionId, payload);
      _showSnack('Fusion "$fusionName" established.');
      widget.onFusionSaved(fusionId, fusionName, payload);
      widget.onClose();
    } catch (_) {
      _showSnack("Failed to deploy fusion.");
    } finally {
      if (mounted) setState(() => _isSaving = false);
    }
  }

  @override
  Widget build(BuildContext context) {
    if (!widget.isOpen) return const SizedBox.shrink();

    return Material(
      color: AppColors.bgTooltip,
      child: Column(
        children: [
          _buildHeader(),
          Expanded(
            child: SingleChildScrollView(
              padding: const EdgeInsets.all(AppSpacing.lg),
              child: _buildBody(),
            ),
          ),
          if (_view != _View.picker) _buildFooter(),
        ],
      ),
    );
  }

  static const Map<_View, String> _subtitles = {
    _View.picker: "Command Center",
    _View.aiContextForm: "Cognitive State",
    _View.timeAlignmentForm: "Temporal Target",
    _View.fusionForm: "Neural Link",
  };

  Widget _buildHeader() {
    return Container(
      padding: const EdgeInsets.all(AppSpacing.lg),
      decoration: const BoxDecoration(
        color: Color(0x05FFFFFF),
        border: Border(bottom: BorderSide(color: AppColors.borderSubtle)),
      ),
      child: Row(
        children: [
          Container(
            padding: const EdgeInsets.all(AppSpacing.sm + 2),
            decoration: BoxDecoration(
              color: Colors.white.withValues(alpha: 0.05),
              border: Border.all(color: Colors.white.withValues(alpha: 0.05)),
              borderRadius: BorderRadius.circular(AppRadius.md),
            ),
            child: const Icon(Icons.memory, size: 20, color: AppColors.textSecondary),
          ),
          const SizedBox(width: AppSpacing.sm),
          Expanded(
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Text("Orchestrator", style: AppTypography.h1.copyWith(fontSize: 15)),
                const SizedBox(height: 2),
                Text(
                  _subtitles[_view]!.toUpperCase(),
                  style: AppTypography.labelCaps.copyWith(fontSize: 10),
                ),
              ],
            ),
          ),
          IconButton(
            icon: const Icon(Icons.close, size: 18),
            color: AppColors.textMuted,
            onPressed: widget.onClose,
          ),
        ],
      ),
    );
  }

  Widget _buildBody() {
    switch (_view) {
      case _View.picker:
        return _pickerView();
      case _View.fusionForm:
        return _fusionFormView();
      case _View.timeAlignmentForm:
        return _timeAlignmentView();
      case _View.aiContextForm:
        return _aiContextView();
    }
  }

  Widget _pickerView() {
    final investigation = ref.watch(investigationProvider);
    final investigationNotifier = ref.read(investigationProvider.notifier);
    final clusteringStatus = ref.watch(clusteringProvider).status;
    final clusteringNotifier = ref.read(clusteringProvider.notifier);

    return Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        _sectionLabel("Visualizers"),
        const SizedBox(height: AppSpacing.sm),
        _layerRow(
          icon: Icons.auto_awesome,
          label: "Log Distribution",
          desc: "Timeline density matching",
          checked: investigation.showDistribution,
          onChanged: investigationNotifier.setShowDistribution,
        ),
        const SizedBox(height: AppSpacing.xs),
        _layerRow(
          icon: Icons.auto_awesome,
          label: "Anomaly Radar",
          desc: "Detect statistical violations",
          checked: investigation.showAnomalies,
          onChanged: investigationNotifier.setShowAnomalies,
        ),
        const SizedBox(height: AppSpacing.lg),
        _sectionLabel("Intelligence"),
        const SizedBox(height: AppSpacing.sm),
        _actionRow(
          icon: Icons.auto_awesome,
          iconActive: investigation.workspaceGlobalContext != null,
          label: "Knowledge Base",
          desc: investigation.workspaceGlobalContext != null ? "Context active" : "Inject structure",
          actionLabel: investigation.workspaceGlobalContext != null ? "Edit" : "Set",
          onTap: () {
            _contextController.text = investigation.workspaceGlobalContext ?? "";
            setState(() => _view = _View.aiContextForm);
          },
        ),
        const SizedBox(height: AppSpacing.lg),
        _sectionLabel("Engine Performance"),
        const SizedBox(height: AppSpacing.sm),
        _layerRow(
          icon: Icons.memory,
          label: "Enable Clustering",
          desc: "Drain3 Pattern Mining",
          checked: !(clusteringStatus?.paused ?? false),
          onChanged: (checked) => clusteringNotifier.setPaused(!checked, workspaceId: widget.workspaceId),
        ),
        const SizedBox(height: AppSpacing.lg),
        _sectionLabel("Engine"),
        const SizedBox(height: AppSpacing.sm),
        _actionRow(
          icon: Icons.layers,
          iconActive: false,
          label: "Core Parser",
          desc: "Drain3 Configuration",
          actionLabel: "Configure",
          onTap: () {
            widget.onClose();
            widget.onEngineSettingsOpen?.call();
          },
        ),
        const SizedBox(height: AppSpacing.lg),
        _sectionLabel("Operations"),
        const SizedBox(height: AppSpacing.sm),
        _strategyCard(
          icon: Icons.bolt,
          name: "Log Fusion",
          desc: "Combine different log streams together.",
          onTap: () => setState(() => _view = _View.fusionForm),
        ),
        const SizedBox(height: AppSpacing.xs),
        _strategyCard(
          icon: Icons.access_time,
          name: "Temporal Sync",
          desc: "Align clocks across multiple files.",
          onTap: () => setState(() => _view = _View.timeAlignmentForm),
        ),
      ],
    );
  }

  Widget _fusionFormView() {
    return Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        _backButton(),
        const SizedBox(height: AppSpacing.lg),
        Text(
          "NAME",
          style: AppTypography.labelCaps.copyWith(fontSize: 10),
        ),
        const SizedBox(height: 6),
        TextField(
          controller: _fusionNameController,
          decoration: const InputDecoration(
            isDense: true,
            hintText: "e.g. Cluster Primary 01",
          ),
          style: AppTypography.body.copyWith(fontSize: 13),
        ),
        const SizedBox(height: AppSpacing.lg),
        Text("SOURCES", style: AppTypography.labelCaps.copyWith(fontSize: 10)),
        const SizedBox(height: AppSpacing.sm),
        if (_isLoadingConfig)
          const Padding(
            padding: EdgeInsets.symmetric(vertical: 40),
            child: Center(
              child: Column(
                mainAxisSize: MainAxisSize.min,
                children: [
                  SizedBox(
                    width: 20,
                    height: 20,
                    child: CircularProgressIndicator(strokeWidth: 2),
                  ),
                  SizedBox(height: AppSpacing.sm),
                  Text("Loading", style: TextStyle(fontSize: 11, color: AppColors.textMuted)),
                ],
              ),
            ),
          )
        else
          Column(
            children: [for (final config in _configs) _sourceConfigRow(config)],
          ),
      ],
    );
  }

  Widget _sourceConfigRow(FusionSourceConfig config) {
    final hasParser = config.parserConfig != null && config.parserConfig!.isNotEmpty;
    return Container(
      margin: const EdgeInsets.only(bottom: AppSpacing.sm),
      padding: const EdgeInsets.all(AppSpacing.sm + 4),
      decoration: BoxDecoration(
        color: config.enabled
            ? Colors.white.withValues(alpha: 0.04)
            : Colors.white.withValues(alpha: 0.01),
        border: Border.all(
          color: config.enabled ? Colors.white.withValues(alpha: 0.2) : AppColors.borderSubtle,
        ),
        borderRadius: BorderRadius.circular(AppRadius.lg),
      ),
      child: Row(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          InkWell(
            key: Key("orchestratorSourceCheckbox_${config.sourceId}"),
            onTap: () => _toggleSource(config.sourceId),
            borderRadius: BorderRadius.circular(4),
            child: Container(
              width: 18,
              height: 18,
              alignment: Alignment.center,
              decoration: BoxDecoration(
                color: config.enabled ? Colors.white : Colors.transparent,
                border: config.enabled ? null : Border.all(color: Colors.white.withValues(alpha: 0.2)),
                borderRadius: BorderRadius.circular(4),
              ),
              child: config.enabled
                  ? const Icon(Icons.check, size: 12, color: Colors.black)
                  : null,
            ),
          ),
          const SizedBox(width: AppSpacing.sm),
          Expanded(
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Text(
                  _labelFor(config.sourceId),
                  maxLines: 1,
                  overflow: TextOverflow.ellipsis,
                  style: AppTypography.body.copyWith(
                    fontSize: 13,
                    fontWeight: FontWeight.w600,
                    color: config.enabled ? AppColors.textPrimary : AppColors.textSecondary,
                  ),
                ),
                if (config.enabled && _templates.isNotEmpty)
                  Padding(
                    padding: const EdgeInsets.only(top: 4),
                    child: DropdownButtonHideUnderline(
                      child: DropdownButton<String>(
                        isDense: true,
                        hint: Text(
                          "Apply Template...",
                          style: AppTypography.body.copyWith(fontSize: 10, color: AppColors.textMuted),
                        ),
                        items: [
                          for (final t in _templates)
                            DropdownMenuItem(
                              value: t.id.toString(),
                              child: Text(t.name, style: const TextStyle(fontSize: 11)),
                            ),
                        ],
                        onChanged: (value) {
                          if (value != null) _applyTemplateToSource(config.sourceId, value);
                        },
                      ),
                    ),
                  ),
              ],
            ),
          ),
          if (config.enabled)
            IconButton(
              tooltip: "Configure Extraction Parser",
              iconSize: 16,
              icon: Icon(
                Icons.tune,
                color: hasParser ? AppColors.textPrimary : AppColors.textMuted,
              ),
              onPressed: () => _openParserModal(config.sourceId),
            ),
        ],
      ),
    );
  }

  Widget _timeAlignmentView() {
    return Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        _backButton(),
        const SizedBox(height: AppSpacing.lg),
        Text(
          "Adjust time offsets out-of-sync lines.",
          style: AppTypography.body.copyWith(fontSize: 12, color: AppColors.textSecondary),
        ),
        const SizedBox(height: AppSpacing.md),
        for (final source in widget.availableSources) _temporalRow(source),
      ],
    );
  }

  Widget _temporalRow(LogSource source) {
    final offset = _temporalOffsets[source.path] ?? 0;
    final formatted = offset == 0 ? "0s" : "${offset > 0 ? '+' : ''}${offset}s";
    return Container(
      margin: const EdgeInsets.only(bottom: AppSpacing.sm),
      padding: const EdgeInsets.all(AppSpacing.sm + 4),
      decoration: BoxDecoration(
        color: Colors.white.withValues(alpha: 0.02),
        border: Border.all(color: Colors.white.withValues(alpha: 0.05)),
        borderRadius: BorderRadius.circular(AppRadius.lg),
      ),
      child: Row(
        children: [
          Expanded(
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Text(
                  source.name,
                  maxLines: 1,
                  overflow: TextOverflow.ellipsis,
                  style: AppTypography.body.copyWith(fontSize: 13, fontWeight: FontWeight.w600),
                ),
                const SizedBox(height: 2),
                Row(
                  children: [
                    const Icon(Icons.schedule, size: 12, color: AppColors.textMuted),
                    const SizedBox(width: 4),
                    Text(formatted, style: AppTypography.log.copyWith(fontSize: 11, color: AppColors.textSecondary)),
                  ],
                ),
              ],
            ),
          ),
          OutlinedButton(
            key: Key("orchestratorSyncButton_${source.path}"),
            onPressed: () => _openTimeShift(source),
            child: const Text("Sync", style: TextStyle(fontSize: 11)),
          ),
        ],
      ),
    );
  }

  Widget _aiContextView() {
    return Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        _backButton(),
        const SizedBox(height: AppSpacing.lg),
        Text(
          "Add architecture constraints for AI to know.",
          style: AppTypography.body.copyWith(fontSize: 12, color: AppColors.textSecondary),
        ),
        const SizedBox(height: AppSpacing.sm),
        TextField(
          controller: _contextController,
          minLines: 12,
          maxLines: 20,
          style: AppTypography.monoBody.copyWith(fontSize: 13),
          decoration: const InputDecoration(hintText: "Define schemas or domains..."),
        ),
      ],
    );
  }

  Widget _backButton() {
    return InkWell(
      onTap: () => setState(() => _view = _View.picker),
      child: Row(
        mainAxisSize: MainAxisSize.min,
        children: [
          const Icon(Icons.arrow_back, size: 14, color: AppColors.textSecondary),
          const SizedBox(width: 4),
          Text(
            "Back",
            style: AppTypography.body.copyWith(fontSize: 11, color: AppColors.textSecondary),
          ),
        ],
      ),
    );
  }

  Widget _buildFooter() {
    return Container(
      padding: const EdgeInsets.all(AppSpacing.md),
      decoration: const BoxDecoration(
        color: Color(0x03FFFFFF),
        border: Border(top: BorderSide(color: AppColors.borderSubtle)),
      ),
      child: Row(
        children: [
          Expanded(
            child: TextButton(
              onPressed: () => setState(() => _view = _View.picker),
              child: const Text("Cancel"),
            ),
          ),
          const SizedBox(width: AppSpacing.sm),
          Expanded(child: _primaryFooterButton()),
        ],
      ),
    );
  }

  Widget _primaryFooterButton() {
    switch (_view) {
      case _View.aiContextForm:
        return ElevatedButton(
          onPressed: () {
            final trimmed = _contextController.text.trim();
            ref.read(investigationProvider.notifier).setWorkspaceGlobalContext(trimmed.isEmpty ? null : trimmed);
            _showSnack("Cognition saved");
            setState(() => _view = _View.picker);
          },
          child: const Text("Save"),
        );
      case _View.timeAlignmentForm:
        return ElevatedButton(
          onPressed: _isSaving ? null : _saveTemporalOffsets,
          child: Text(_isSaving ? "Syncing..." : "Apply"),
        );
      case _View.fusionForm:
        final enabledCount = _configs.where((c) => c.enabled).length;
        return ElevatedButton(
          onPressed: (_isSaving || enabledCount < 2) ? null : _deployFusion,
          child: Text(_isSaving ? "Saving..." : "Deploy"),
        );
      case _View.picker:
        return const SizedBox.shrink();
    }
  }

  Widget _sectionLabel(String text) {
    return Text(text.toUpperCase(), style: AppTypography.labelCaps.copyWith(fontSize: 11));
  }

  Widget _layerRow({
    required IconData icon,
    required String label,
    required String desc,
    required bool checked,
    required ValueChanged<bool> onChanged,
  }) {
    return Container(
      padding: const EdgeInsets.all(AppSpacing.sm + 4),
      decoration: BoxDecoration(
        color: Colors.white.withValues(alpha: 0.02),
        border: Border.all(color: Colors.white.withValues(alpha: 0.05)),
        borderRadius: BorderRadius.circular(AppRadius.lg),
      ),
      child: Row(
        children: [
          Container(
            width: 32,
            height: 32,
            alignment: Alignment.center,
            decoration: BoxDecoration(
              color: Colors.white.withValues(alpha: 0.05),
              border: Border.all(color: Colors.white.withValues(alpha: 0.1)),
              borderRadius: BorderRadius.circular(AppRadius.md),
            ),
            child: Icon(icon, size: 16, color: AppColors.textSecondary),
          ),
          const SizedBox(width: AppSpacing.sm),
          Expanded(
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Text(label, style: AppTypography.body.copyWith(fontSize: 13, fontWeight: FontWeight.w600)),
                Text(desc, style: AppTypography.body.copyWith(fontSize: 11, color: AppColors.textMuted)),
              ],
            ),
          ),
          Switch(value: checked, onChanged: onChanged),
        ],
      ),
    );
  }

  Widget _actionRow({
    required IconData icon,
    required bool iconActive,
    required String label,
    required String desc,
    required String actionLabel,
    required VoidCallback onTap,
  }) {
    return Container(
      padding: const EdgeInsets.all(AppSpacing.sm + 4),
      decoration: BoxDecoration(
        color: Colors.white.withValues(alpha: 0.02),
        border: Border.all(color: Colors.white.withValues(alpha: 0.05)),
        borderRadius: BorderRadius.circular(AppRadius.lg),
      ),
      child: Row(
        children: [
          Container(
            width: 32,
            height: 32,
            alignment: Alignment.center,
            decoration: BoxDecoration(
              color: Colors.white.withValues(alpha: 0.05),
              border: Border.all(color: Colors.white.withValues(alpha: 0.1)),
              borderRadius: BorderRadius.circular(AppRadius.md),
            ),
            child: Icon(icon, size: 16, color: iconActive ? AppColors.textPrimary : AppColors.textMuted),
          ),
          const SizedBox(width: AppSpacing.sm),
          Expanded(
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Text(label, style: AppTypography.body.copyWith(fontSize: 13, fontWeight: FontWeight.w600)),
                Text(
                  desc,
                  maxLines: 1,
                  overflow: TextOverflow.ellipsis,
                  style: AppTypography.body.copyWith(fontSize: 11, color: AppColors.textMuted),
                ),
              ],
            ),
          ),
          TextButton(
            onPressed: onTap,
            child: Text(actionLabel, style: const TextStyle(fontSize: 11)),
          ),
        ],
      ),
    );
  }

  Widget _strategyCard({
    required IconData icon,
    required String name,
    required String desc,
    required VoidCallback onTap,
  }) {
    return Material(
      color: Colors.white.withValues(alpha: 0.02),
      borderRadius: BorderRadius.circular(AppRadius.lg),
      child: InkWell(
        onTap: onTap,
        borderRadius: BorderRadius.circular(AppRadius.lg),
        child: Container(
          padding: const EdgeInsets.all(AppSpacing.sm + 4),
          decoration: BoxDecoration(
            border: Border.all(color: Colors.white.withValues(alpha: 0.05)),
            borderRadius: BorderRadius.circular(AppRadius.lg),
          ),
          child: Row(
            children: [
              Container(
                width: 32,
                height: 32,
                alignment: Alignment.center,
                decoration: BoxDecoration(
                  color: Colors.white.withValues(alpha: 0.05),
                  border: Border.all(color: Colors.white.withValues(alpha: 0.1)),
                  borderRadius: BorderRadius.circular(AppRadius.md),
                ),
                child: Icon(icon, size: 16, color: AppColors.textSecondary),
              ),
              const SizedBox(width: AppSpacing.sm),
              Expanded(
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    Text(name, style: AppTypography.body.copyWith(fontSize: 13, fontWeight: FontWeight.w600)),
                    Text(
                      desc,
                      maxLines: 1,
                      overflow: TextOverflow.ellipsis,
                      style: AppTypography.body.copyWith(fontSize: 11, color: AppColors.textMuted),
                    ),
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
