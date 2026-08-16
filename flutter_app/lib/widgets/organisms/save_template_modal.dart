/// Dart port of `src/components/organisms/SaveTemplateModal.tsx`.
///
/// Modal for naming and persisting the current filter/highlight
/// configuration as a reusable template. Self-managed visibility, same
/// pattern as `LoadTemplateModal`/`ImportFeedModal` in this batch: renders
/// nothing when [isOpen] is false.
library;

import "package:flutter/material.dart";
import "package:flutter_riverpod/flutter_riverpod.dart";

import "../../models/log_entry.dart";
import "../../providers/template_provider.dart";
import "../../theme/app_theme.dart";
import "../molecules/highlight_builder.dart";
import "template_codec.dart";

class SaveTemplateModal extends ConsumerStatefulWidget {
  const SaveTemplateModal({
    super.key,
    required this.isOpen,
    required this.onClose,
    required this.workspaceId,
    required this.filters,
    required this.highlights,
  });

  final bool isOpen;
  final VoidCallback onClose;
  final String workspaceId;
  final List<LogFilter> filters;
  final List<HighlightRule> highlights;

  @override
  ConsumerState<SaveTemplateModal> createState() => _SaveTemplateModalState();
}

class _SaveTemplateModalState extends ConsumerState<SaveTemplateModal> {
  final _nameController = TextEditingController();
  bool _isSaving = false;

  @override
  void dispose() {
    _nameController.dispose();
    super.dispose();
  }

  void _showSnack(String message) {
    ScaffoldMessenger.of(context).showSnackBar(SnackBar(content: Text(message)));
  }

  Future<void> _handleSave() async {
    final name = _nameController.text.trim();
    if (name.isEmpty) {
      _showSnack("Please enter a template name");
      return;
    }

    setState(() => _isSaving = true);
    try {
      final configJson = TemplateConfig(
        filters: widget.filters,
        highlights: widget.highlights,
      ).encode();
      await ref.read(templateServiceProvider).saveTemplate(
        workspaceId: widget.workspaceId,
        name: name,
        configJson: configJson,
      );
      if (!mounted) return;
      _showSnack("Discovery template saved");
      _nameController.clear();
      setState(() => _isSaving = false);
      widget.onClose();
    } catch (_) {
      if (!mounted) return;
      setState(() => _isSaving = false);
      _showSnack("Could not save template");
    }
  }

  @override
  Widget build(BuildContext context) {
    if (!widget.isOpen) return const SizedBox.shrink();

    final canSave = !_isSaving && _nameController.text.trim().isNotEmpty;

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
              constraints: const BoxConstraints(maxWidth: 425),
              child: Container(
                padding: const EdgeInsets.all(AppSpacing.lg),
                decoration: BoxDecoration(
                  color: AppColors.bgSurface,
                  border: Border.all(color: AppColors.borderSubtle),
                  borderRadius: BorderRadius.circular(AppRadius.xl),
                ),
                child: Column(
                  mainAxisSize: MainAxisSize.min,
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    Row(
                      children: [
                        Container(
                          padding: const EdgeInsets.all(AppSpacing.sm),
                          decoration: BoxDecoration(
                            color: AppColors.primary.withValues(alpha: 0.1),
                            border: Border.all(color: AppColors.primary.withValues(alpha: 0.2)),
                            borderRadius: BorderRadius.circular(AppRadius.md),
                          ),
                          child: const Icon(
                            Icons.dashboard_customize_outlined,
                            size: 18,
                            color: AppColors.primary,
                          ),
                        ),
                        const SizedBox(width: AppSpacing.sm),
                        Text("Save Template", style: AppTypography.h1.copyWith(fontSize: 20)),
                      ],
                    ),
                    const SizedBox(height: AppSpacing.sm),
                    Text(
                      "Persist your current filter and highlight configuration as a reusable template.",
                      style: AppTypography.body.copyWith(fontSize: 12, color: AppColors.textMuted),
                    ),
                    const SizedBox(height: AppSpacing.lg),
                    Text(
                      "TEMPLATE NAME",
                      style: AppTypography.labelCaps.copyWith(fontSize: 10),
                    ),
                    const SizedBox(height: AppSpacing.xs),
                    TextField(
                      controller: _nameController,
                      autofocus: true,
                      enabled: !_isSaving,
                      onChanged: (_) => setState(() {}),
                      onSubmitted: (_) => canSave ? _handleSave() : null,
                      decoration: const InputDecoration(
                        isDense: true,
                        hintText: "e.g. Production Error Analysis",
                      ),
                      style: AppTypography.body.copyWith(fontSize: 13),
                    ),
                    const SizedBox(height: AppSpacing.lg),
                    Container(
                      padding: const EdgeInsets.all(AppSpacing.md),
                      decoration: BoxDecoration(
                        color: Colors.white.withValues(alpha: 0.03),
                        borderRadius: BorderRadius.circular(AppRadius.lg),
                      ),
                      child: Row(
                        children: [
                          const Icon(Icons.filter_alt_outlined, size: 14, color: AppColors.primary),
                          const SizedBox(width: 6),
                          Text(
                            "${widget.filters.length} Filters",
                            style: AppTypography.body.copyWith(
                              fontSize: 12,
                              color: AppColors.textSecondary,
                            ),
                          ),
                          const SizedBox(width: AppSpacing.md),
                          const Icon(Icons.highlight_alt, size: 14, color: AppColors.highlight4),
                          const SizedBox(width: 6),
                          Text(
                            "${widget.highlights.length} Highlights",
                            style: AppTypography.body.copyWith(
                              fontSize: 12,
                              color: AppColors.textSecondary,
                            ),
                          ),
                        ],
                      ),
                    ),
                    const SizedBox(height: AppSpacing.lg),
                    Row(
                      mainAxisAlignment: MainAxisAlignment.end,
                      children: [
                        OutlinedButton(
                          onPressed: _isSaving ? null : widget.onClose,
                          child: const Text("Cancel"),
                        ),
                        const SizedBox(width: AppSpacing.sm),
                        ElevatedButton(
                          onPressed: canSave ? _handleSave : null,
                          child: Text(_isSaving ? "Saving..." : "Save Template"),
                        ),
                      ],
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
}
