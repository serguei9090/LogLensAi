/// Dart port of `src/components/organisms/FusionConfigEngine.tsx`.
///
/// Full-panel multi-source log-fusion configuration UI: per-source
/// enable/timezone-offset controls plus a "Deploy Fusion" save action.
/// Fetches/saves via [fusionConfigServiceProvider] (a small dedicated
/// provider, see that file's doc comment for why fusion config isn't bolted
/// onto an existing store).
///
/// Deviations from the React source:
///  - The custom `TimezoneSelect` (a hand-rolled dropdown rendered through a
///    `createPortal` to escape overflow clipping, with outside-click-to-close
///    and scroll-into-view-on-open) becomes a stock [PopupMenuButton] here.
///    Same 27 UTC-offset options (-12..+14), same "UTC ±HH:00" label format,
///    same selected-state highlighting -- just backed by Flutter's own
///    overlay/positioning instead of a reimplemented one.
///  - The React version always opens `CustomParserModal` (a sibling organism
///    owned by a different agent in this migration pass) for the per-source
///    "Configure Extraction Parser" action. To avoid a hard dependency on
///    another in-flight organism, that action is exposed as an optional
///    [parserModalBuilder] slot; the host page can wire in the real
///    `CustomParserModal` once it exists. Without one supplied, tapping the
///    button opens a minimal built-in fallback (a single JSON text field)
///    so the affordance still works standalone.
library;

import "package:flutter/material.dart";
import "package:flutter_riverpod/flutter_riverpod.dart";

import "../../models/fusion_config.dart";
import "../../models/workspace.dart";
import "../../providers/fusion_provider.dart";
import "../../theme/app_theme.dart";

/// Builder signature for a pluggable "configure extraction parser" modal.
/// See the class doc comment for why this is a slot rather than a direct
/// `CustomParserModal` dependency.
typedef ParserModalBuilder =
    Widget Function(
      BuildContext context, {
      required String sourceId,
      required String? initialConfig,
      required ValueChanged<String> onSaved,
    });

class FusionConfigEngine extends ConsumerStatefulWidget {
  const FusionConfigEngine({
    super.key,
    required this.workspaceId,
    required this.availableSources,
    required this.onConfigSaved,
    this.parserModalBuilder,
  });

  final String workspaceId;
  final List<LogSource> availableSources;
  final VoidCallback onConfigSaved;
  final ParserModalBuilder? parserModalBuilder;

  @override
  ConsumerState<FusionConfigEngine> createState() => _FusionConfigEngineState();
}

class _FusionConfigEngineState extends ConsumerState<FusionConfigEngine> {
  List<FusionSourceConfig> _configs = const [];
  bool _isLoading = true;
  bool _isSaving = false;
  String? _activeParserSourceId;

  @override
  void initState() {
    super.initState();
    _load();
  }

  void _showSnack(String message) {
    if (!mounted) return;
    ScaffoldMessenger.of(context).showSnackBar(SnackBar(content: Text(message)));
  }

  Future<void> _load() async {
    try {
      final existing = await ref
          .read(fusionConfigServiceProvider)
          .fetchConfig(widget.workspaceId);
      final merged = widget.availableSources.map((source) {
        final match = existing.where((c) => c.sourceId == source.path);
        return match.isNotEmpty
            ? match.first
            : FusionSourceConfig(sourceId: source.path, enabled: true, tzOffset: 0);
      }).toList();
      if (!mounted) return;
      setState(() {
        _configs = merged;
        _isLoading = false;
      });
    } catch (_) {
      if (!mounted) return;
      setState(() => _isLoading = false);
      _showSnack("Could not sync orchestration settings.");
    }
  }

  void _toggleSource(String sourceId) {
    setState(() {
      _configs = _configs
          .map((c) => c.sourceId == sourceId ? c.copyWith(enabled: !c.enabled) : c)
          .toList();
    });
  }

  void _updateOffset(String sourceId, int offset) {
    setState(() {
      _configs = _configs
          .map((c) => c.sourceId == sourceId ? c.copyWith(tzOffset: offset) : c)
          .toList();
    });
  }

  void _handleParserSaved(String sourceId, String configJson) {
    setState(() {
      _configs = _configs
          .map((c) => c.sourceId == sourceId ? c.copyWith(parserConfig: configJson) : c)
          .toList();
    });
    _showSnack("Extraction pattern updated locally.");
  }

  Future<void> _handleSave() async {
    setState(() => _isSaving = true);
    try {
      await ref
          .read(fusionConfigServiceProvider)
          .saveConfig(widget.workspaceId, _configs);
      if (!mounted) return;
      _showSnack("Fusion orchestration updated.");
      widget.onConfigSaved();
    } catch (_) {
      _showSnack("Failed to persist orchestration settings.");
    } finally {
      if (mounted) setState(() => _isSaving = false);
    }
  }

  @override
  Widget build(BuildContext context) {
    if (_isLoading) {
      return const Center(
        child: Text(
          "INITIALIZING FUSION ENGINE...",
          style: TextStyle(
            fontSize: 11,
            fontWeight: FontWeight.w700,
            letterSpacing: 1.5,
            color: AppColors.textMuted,
          ),
        ),
      );
    }

    return Center(
      child: SingleChildScrollView(
        padding: const EdgeInsets.all(AppSpacing.lg),
        child: ConstrainedBox(
          constraints: const BoxConstraints(maxWidth: 760),
          child: Column(
            mainAxisSize: MainAxisSize.min,
            children: [
              Container(
                padding: const EdgeInsets.all(AppSpacing.lg),
                decoration: BoxDecoration(
                  color: AppColors.bgSurface.withValues(alpha: 0.4),
                  border: Border.all(color: AppColors.borderSubtle),
                  borderRadius: BorderRadius.circular(AppRadius.lg),
                ),
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    Row(
                      children: [
                        Container(
                          padding: const EdgeInsets.all(AppSpacing.sm + 4),
                          decoration: BoxDecoration(
                            color: AppColors.primary.withValues(alpha: 0.1),
                            border: Border.all(color: AppColors.primary.withValues(alpha: 0.2)),
                            borderRadius: BorderRadius.circular(AppRadius.lg),
                          ),
                          child: const Icon(Icons.public, color: AppColors.primary, size: 22),
                        ),
                        const SizedBox(width: AppSpacing.md),
                        Expanded(
                          child: Column(
                            crossAxisAlignment: CrossAxisAlignment.start,
                            children: [
                              Text(
                                "FUSION ORCHESTRATION",
                                style: AppTypography.h1.copyWith(fontSize: 18),
                              ),
                              const SizedBox(height: 2),
                              Text(
                                "Interleave and synchronize multi-source logs",
                                style: AppTypography.body.copyWith(
                                  fontSize: 12,
                                  color: AppColors.textMuted,
                                ),
                              ),
                            ],
                          ),
                        ),
                      ],
                    ),
                    const SizedBox(height: AppSpacing.md),
                    const Divider(height: 1, color: AppColors.borderMuted),
                    const SizedBox(height: AppSpacing.md),
                    ConstrainedBox(
                      constraints: const BoxConstraints(maxHeight: 400),
                      child: _configs.isEmpty
                          ? const Padding(
                              padding: EdgeInsets.symmetric(vertical: 48),
                              child: Column(
                                children: [
                                  Icon(Icons.close, size: 36, color: AppColors.textMuted),
                                  SizedBox(height: AppSpacing.sm),
                                  Text(
                                    "No log sources added to this workspace yet.",
                                    style: TextStyle(fontSize: 13, color: AppColors.textMuted),
                                  ),
                                ],
                              ),
                            )
                          : SingleChildScrollView(
                              child: Column(
                                children: [
                                  for (final config in _configs) ...[
                                    _SourceRow(
                                      config: config,
                                      label: _labelFor(config.sourceId),
                                      onToggle: () => _toggleSource(config.sourceId),
                                      onOffsetChanged: (v) => _updateOffset(config.sourceId, v),
                                      onConfigureParser: () =>
                                          setState(() => _activeParserSourceId = config.sourceId),
                                    ),
                                    const SizedBox(height: AppSpacing.sm),
                                  ],
                                ],
                              ),
                            ),
                    ),
                    const SizedBox(height: AppSpacing.md),
                    const Divider(height: 1, color: AppColors.borderMuted),
                    const SizedBox(height: AppSpacing.md),
                    Row(
                      mainAxisAlignment: MainAxisAlignment.spaceBetween,
                      children: [
                        Column(
                          crossAxisAlignment: CrossAxisAlignment.start,
                          children: [
                            Text(
                              "SYNC STRATEGY",
                              style: AppTypography.labelCaps.copyWith(fontSize: 10),
                            ),
                            Text(
                              "Interleaved Timestamp Alignment",
                              style: AppTypography.body.copyWith(
                                fontSize: 13,
                                fontWeight: FontWeight.w700,
                                fontStyle: FontStyle.italic,
                                color: AppColors.primary,
                              ),
                            ),
                          ],
                        ),
                        ElevatedButton.icon(
                          onPressed: (_isSaving || _configs.isEmpty) ? null : _handleSave,
                          icon: _isSaving
                              ? const SizedBox(
                                  width: 14,
                                  height: 14,
                                  child: CircularProgressIndicator(
                                    strokeWidth: 2,
                                    color: AppColors.textInverse,
                                  ),
                                )
                              : const Icon(Icons.save_outlined, size: 16),
                          label: const Text("Deploy Fusion"),
                        ),
                      ],
                    ),
                  ],
                ),
              ),
              const SizedBox(height: AppSpacing.lg),
              Padding(
                padding: const EdgeInsets.symmetric(horizontal: AppSpacing.xl),
                child: Text(
                  "Fusion Mode merges all enabled sources into a single stream. Use Sync Drift to "
                  "align logs living in different timezones.",
                  textAlign: TextAlign.center,
                  style: AppTypography.body.copyWith(fontSize: 11, color: AppColors.textMuted),
                ),
              ),
              if (_activeParserSourceId != null) _buildParserModal(_activeParserSourceId!),
            ],
          ),
        ),
      ),
    );
  }

  String _labelFor(String sourceId) {
    final match = widget.availableSources.where((s) => s.path == sourceId);
    if (match.isNotEmpty) return match.first.name;
    final parts = sourceId.split(RegExp(r"[\\/]"));
    return parts.isNotEmpty ? parts.last : sourceId;
  }

  Widget _buildParserModal(String sourceId) {
    final initial = _configs.where((c) => c.sourceId == sourceId);
    final initialConfig = initial.isNotEmpty ? initial.first.parserConfig : null;
    void onSaved(String json) {
      _handleParserSaved(sourceId, json);
      setState(() => _activeParserSourceId = null);
    }

    if (widget.parserModalBuilder != null) {
      return widget.parserModalBuilder!(
        context,
        sourceId: sourceId,
        initialConfig: initialConfig,
        onSaved: onSaved,
      );
    }
    return _FallbackParserDialog(
      sourceId: sourceId,
      initialConfig: initialConfig,
      onSaved: onSaved,
      onClose: () => setState(() => _activeParserSourceId = null),
    );
  }
}

class _SourceRow extends StatelessWidget {
  const _SourceRow({
    required this.config,
    required this.label,
    required this.onToggle,
    required this.onOffsetChanged,
    required this.onConfigureParser,
  });

  final FusionSourceConfig config;
  final String label;
  final VoidCallback onToggle;
  final ValueChanged<int> onOffsetChanged;
  final VoidCallback onConfigureParser;

  static String _offsetLabel(int offset) {
    final sign = offset >= 0 ? "+" : "−";
    final abs = offset.abs().toString().padLeft(2, "0");
    return "UTC $sign$abs:00";
  }

  @override
  Widget build(BuildContext context) {
    final hasParser = config.parserConfig != null && config.parserConfig!.isNotEmpty;
    return Container(
      padding: const EdgeInsets.all(AppSpacing.sm + 4),
      decoration: BoxDecoration(
        color: config.enabled
            ? AppColors.primary.withValues(alpha: 0.05)
            : AppColors.bgBase.withValues(alpha: 0.4),
        border: Border.all(
          color: config.enabled ? AppColors.primary.withValues(alpha: 0.2) : AppColors.borderSubtle,
        ),
        borderRadius: BorderRadius.circular(AppRadius.md),
      ),
      child: Row(
        children: [
          InkWell(
            onTap: onToggle,
            borderRadius: BorderRadius.circular(4),
            child: Container(
              width: 20,
              height: 20,
              alignment: Alignment.center,
              decoration: BoxDecoration(
                color: config.enabled ? AppColors.primary : Colors.transparent,
                border: config.enabled
                    ? null
                    : Border.all(color: AppColors.borderSubtle),
                borderRadius: BorderRadius.circular(4),
              ),
              child: config.enabled
                  ? const Icon(Icons.check, size: 14, color: AppColors.textInverse)
                  : null,
            ),
          ),
          const SizedBox(width: AppSpacing.sm),
          Expanded(
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Text(
                  label,
                  maxLines: 1,
                  overflow: TextOverflow.ellipsis,
                  style: AppTypography.body.copyWith(
                    fontSize: 13,
                    fontWeight: FontWeight.w600,
                    color: AppColors.textSecondary,
                  ),
                ),
                Text(
                  config.sourceId,
                  maxLines: 1,
                  overflow: TextOverflow.ellipsis,
                  style: AppTypography.log.copyWith(fontSize: 10, color: AppColors.textMuted),
                ),
              ],
            ),
          ),
          const SizedBox(width: AppSpacing.sm),
          Column(
            crossAxisAlignment: CrossAxisAlignment.end,
            children: [
              Text(
                "SYNC DRIFT",
                style: AppTypography.labelCaps.copyWith(fontSize: 9),
              ),
              const SizedBox(height: 2),
              PopupMenuButton<int>(
                tooltip: "Choose UTC offset",
                initialValue: config.tzOffset,
                onSelected: onOffsetChanged,
                color: AppColors.bgSurfaceBright,
                itemBuilder: (context) => [
                  for (var offset = -12; offset <= 14; offset++)
                    PopupMenuItem<int>(
                      value: offset,
                      child: Text(
                        _offsetLabel(offset),
                        style: AppTypography.log.copyWith(
                          fontSize: 11,
                          fontWeight: offset == config.tzOffset ? FontWeight.w700 : FontWeight.w400,
                          color: offset == config.tzOffset ? AppColors.primary : AppColors.textPrimary,
                        ),
                      ),
                    ),
                ],
                child: Container(
                  height: 32,
                  padding: const EdgeInsets.symmetric(horizontal: AppSpacing.sm),
                  decoration: BoxDecoration(
                    color: AppColors.bgSurface,
                    border: Border.all(color: AppColors.borderSubtle),
                    borderRadius: BorderRadius.circular(AppRadius.sm),
                  ),
                  child: Row(
                    mainAxisSize: MainAxisSize.min,
                    children: [
                      const Icon(Icons.schedule, size: 12, color: AppColors.textMuted),
                      const SizedBox(width: 6),
                      Text(
                        _offsetLabel(config.tzOffset),
                        style: AppTypography.log.copyWith(fontSize: 11, fontWeight: FontWeight.w600),
                      ),
                      const Icon(Icons.arrow_drop_down, size: 16, color: AppColors.textMuted),
                    ],
                  ),
                ),
              ),
            ],
          ),
          const SizedBox(width: AppSpacing.sm),
          IconButton(
            tooltip: "Configure Extraction Parser",
            onPressed: onConfigureParser,
            icon: Icon(
              Icons.tune,
              size: 18,
              color: hasParser ? AppColors.textInverse : AppColors.textMuted,
            ),
            style: IconButton.styleFrom(
              backgroundColor: hasParser ? AppColors.primary : AppColors.bgSurfaceBright,
              shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(AppRadius.sm)),
            ),
          ),
        ],
      ),
    );
  }
}

/// Minimal built-in stand-in used when no [ParserModalBuilder] is supplied
/// -- see the class doc comment on [FusionConfigEngine].
class _FallbackParserDialog extends StatefulWidget {
  const _FallbackParserDialog({
    required this.sourceId,
    required this.initialConfig,
    required this.onSaved,
    required this.onClose,
  });

  final String sourceId;
  final String? initialConfig;
  final ValueChanged<String> onSaved;
  final VoidCallback onClose;

  @override
  State<_FallbackParserDialog> createState() => _FallbackParserDialogState();
}

class _FallbackParserDialogState extends State<_FallbackParserDialog> {
  late final _controller = TextEditingController(text: widget.initialConfig ?? "");

  @override
  void dispose() {
    _controller.dispose();
    super.dispose();
  }

  @override
  Widget build(BuildContext context) {
    return AlertDialog(
      backgroundColor: AppColors.bgSurfaceBright,
      title: Text("Extraction Parser — ${widget.sourceId}", style: AppTypography.h2),
      content: SizedBox(
        width: 360,
        child: TextField(
          controller: _controller,
          maxLines: 5,
          style: AppTypography.log.copyWith(fontSize: 12),
          decoration: const InputDecoration(hintText: "Raw parser config JSON..."),
        ),
      ),
      actions: [
        TextButton(onPressed: widget.onClose, child: const Text("Cancel")),
        ElevatedButton(
          onPressed: () => widget.onSaved(_controller.text),
          child: const Text("Save"),
        ),
      ],
    );
  }
}
