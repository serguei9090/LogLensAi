/// Dart port of `src/components/organisms/LoadTemplateModal.tsx`.
///
/// Modal listing saved filter/highlight templates for a workspace; tapping
/// one applies it (via [onLoad]) and closes, a trailing delete button
/// removes it. Self-managed visibility like `ImportFeedModal`: renders
/// nothing when [isOpen] is false rather than going through
/// [Navigator]/`showDialog`, matching the React source's controlled
/// `<Dialog open={isOpen}>` pattern and staying consistent with this
/// organism batch's other modals.
///
/// Deviation: the React version only reveals each row's delete button on
/// hover (`opacity-0 group-hover:opacity-100`). Flutter desktop has no
/// touch-first parity concern here, but hover-only affordances are easy to
/// miss without a mouse-move signal in widget tests -- the delete button is
/// always visible instead.
library;

import "package:flutter/material.dart";
import "package:flutter_riverpod/flutter_riverpod.dart";

import "../../models/log_entry.dart";
import "../../models/template.dart";
import "../../providers/template_provider.dart";
import "../../theme/app_theme.dart";
import "../molecules/highlight_builder.dart";
import "template_codec.dart";

class LoadTemplateModal extends ConsumerStatefulWidget {
  const LoadTemplateModal({
    super.key,
    required this.isOpen,
    required this.onClose,
    required this.workspaceId,
    required this.onLoad,
  });

  final bool isOpen;
  final VoidCallback onClose;
  final String workspaceId;

  /// Fired with the decoded filters/highlights when a template row is
  /// tapped. Caller is responsible for applying them (e.g. to
  /// `investigationProvider`).
  final void Function(List<LogFilter> filters, List<HighlightRule> highlights) onLoad;

  @override
  ConsumerState<LoadTemplateModal> createState() => _LoadTemplateModalState();
}

class _LoadTemplateModalState extends ConsumerState<LoadTemplateModal> {
  List<Template> _templates = const [];
  bool _isLoading = false;

  @override
  void initState() {
    super.initState();
    if (widget.isOpen) _fetch();
  }

  @override
  void didUpdateWidget(covariant LoadTemplateModal oldWidget) {
    super.didUpdateWidget(oldWidget);
    if (widget.isOpen && !oldWidget.isOpen) _fetch();
  }

  Future<void> _fetch() async {
    setState(() => _isLoading = true);
    try {
      final templates = await ref
          .read(templateServiceProvider)
          .fetchTemplates(widget.workspaceId);
      if (!mounted) return;
      setState(() {
        _templates = templates;
        _isLoading = false;
      });
    } catch (_) {
      if (!mounted) return;
      setState(() => _isLoading = false);
      _showSnack("Could not load templates");
    }
  }

  void _showSnack(String message) {
    ScaffoldMessenger.of(context).showSnackBar(SnackBar(content: Text(message)));
  }

  void _handleApply(Template template) {
    try {
      final config = TemplateConfig.decode(template.config);
      widget.onLoad(config.filters, config.highlights);
      _showSnack("Applied template: ${template.name}");
      widget.onClose();
    } catch (_) {
      _showSnack("Template data is corrupted");
    }
  }

  Future<void> _handleDelete(Template template) async {
    try {
      await ref.read(templateServiceProvider).deleteTemplate(template.id);
      if (!mounted) return;
      setState(() => _templates = _templates.where((t) => t.id != template.id).toList());
      _showSnack("Template removed");
    } catch (_) {
      _showSnack("Could not delete template");
    }
  }

  @override
  Widget build(BuildContext context) {
    if (!widget.isOpen) return const SizedBox.shrink();

    return Stack(
      children: [
        Positioned.fill(
          child: GestureDetector(
            onTap: widget.onClose,
            child: Container(color: AppColors.bgBase.withValues(alpha: 0.85)),
          ),
        ),
        Center(
          child: Material(
            color: Colors.transparent,
            child: ConstrainedBox(
              constraints: const BoxConstraints(maxWidth: 500),
              child: Container(
                decoration: BoxDecoration(
                  color: AppColors.bgSurface,
                  border: Border.all(color: AppColors.borderSubtle),
                  borderRadius: BorderRadius.circular(AppRadius.xl),
                ),
                clipBehavior: Clip.antiAlias,
                child: Column(
                  mainAxisSize: MainAxisSize.min,
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    Padding(
                      padding: const EdgeInsets.fromLTRB(
                        AppSpacing.lg,
                        AppSpacing.lg,
                        AppSpacing.lg,
                        AppSpacing.sm,
                      ),
                      child: Column(
                        crossAxisAlignment: CrossAxisAlignment.start,
                        children: [
                          Row(
                            children: [
                              Container(
                                padding: const EdgeInsets.all(AppSpacing.sm),
                                decoration: BoxDecoration(
                                  color: AppColors.primary.withValues(alpha: 0.1),
                                  border: Border.all(
                                    color: AppColors.primary.withValues(alpha: 0.2),
                                  ),
                                  borderRadius: BorderRadius.circular(AppRadius.md),
                                ),
                                child: const Icon(
                                  Icons.dashboard_customize_outlined,
                                  size: 18,
                                  color: AppColors.primary,
                                ),
                              ),
                              const SizedBox(width: AppSpacing.sm),
                              Text("Load Template", style: AppTypography.h1.copyWith(fontSize: 20)),
                            ],
                          ),
                          const SizedBox(height: AppSpacing.sm),
                          Text(
                            "Choose a saved configuration to apply to your current investigation.",
                            style: AppTypography.body.copyWith(
                              fontSize: 12,
                              color: AppColors.textMuted,
                            ),
                          ),
                        ],
                      ),
                    ),
                    Flexible(
                      child: Padding(
                        padding: const EdgeInsets.fromLTRB(
                          AppSpacing.md,
                          0,
                          AppSpacing.md,
                          AppSpacing.lg,
                        ),
                        child: ConstrainedBox(
                          constraints: const BoxConstraints(maxHeight: 400),
                          child: SingleChildScrollView(child: _buildContent()),
                        ),
                      ),
                    ),
                  ],
                ),
              ),
            ),
          ),
        ),
      ],
    );
  }

  Widget _buildContent() {
    if (_isLoading) {
      return const Padding(
        padding: EdgeInsets.symmetric(vertical: 48),
        child: Column(
          children: [
            SizedBox(
              width: 24,
              height: 24,
              child: CircularProgressIndicator(strokeWidth: 2, color: AppColors.textMuted),
            ),
            SizedBox(height: AppSpacing.sm),
            Text(
              "Fetching saved templates...",
              style: TextStyle(fontSize: 11, color: AppColors.textMuted),
            ),
          ],
        ),
      );
    }

    if (_templates.isEmpty) {
      return Container(
        padding: const EdgeInsets.symmetric(vertical: 48),
        decoration: BoxDecoration(
          border: Border.all(color: AppColors.borderSubtle),
          borderRadius: BorderRadius.circular(AppRadius.xl),
        ),
        child: Column(
          children: [
            Icon(Icons.dashboard_customize_outlined, size: 32, color: AppColors.textMuted.withValues(alpha: 0.3)),
            const SizedBox(height: AppSpacing.sm),
            const Text(
              "No templates saved yet",
              style: TextStyle(fontSize: 11, color: AppColors.textMuted),
            ),
          ],
        ),
      );
    }

    return Column(
      children: [
        for (final template in _templates) ...[
          _TemplateRow(
            template: template,
            onTap: () => _handleApply(template),
            onDelete: () => _handleDelete(template),
          ),
          const SizedBox(height: AppSpacing.xs),
        ],
      ],
    );
  }
}

class _TemplateRow extends StatelessWidget {
  const _TemplateRow({required this.template, required this.onTap, required this.onDelete});

  final Template template;
  final VoidCallback onTap;
  final VoidCallback onDelete;

  @override
  Widget build(BuildContext context) {
    return Material(
      color: Colors.white.withValues(alpha: 0.03),
      borderRadius: BorderRadius.circular(AppRadius.lg),
      child: InkWell(
        onTap: onTap,
        borderRadius: BorderRadius.circular(AppRadius.lg),
        child: Padding(
          padding: const EdgeInsets.all(AppSpacing.md),
          child: Row(
            children: [
              Expanded(
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    Text(
                      template.name,
                      style: AppTypography.body.copyWith(
                        fontSize: 13,
                        fontWeight: FontWeight.w700,
                      ),
                    ),
                    const SizedBox(height: 2),
                    Text(
                      template.createdAt,
                      style: AppTypography.log.copyWith(fontSize: 10, color: AppColors.textMuted),
                    ),
                  ],
                ),
              ),
              IconButton(
                tooltip: "Delete template",
                icon: const Icon(Icons.delete_outline, size: 16),
                color: AppColors.textMuted,
                onPressed: onDelete,
              ),
            ],
          ),
        ),
      ),
    );
  }
}
