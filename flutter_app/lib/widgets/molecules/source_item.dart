/// Dart port of `src/components/molecules/SourceItem.tsx`.
///
/// A single log-source row used in the explorer/sidebar hierarchy tree:
/// file icon, name (or inline rename field), an [IngestionProgressBadge]
/// when a job is in flight for this source, and rename/delete actions.
///
/// Data-flow deviation: the React component reaches into `ingestionStore`
/// itself (via `useIngestionStore`) to find its own job/transitioning
/// state. This port keeps molecules presentation-only (see
/// [IngestionOverlay], [ProcessingNotification]): the caller (an organism,
/// wired to `ingestionProvider`) resolves [badgeStatus]/[progress]/
/// [queuePosition] for this source and passes them in directly.
///
/// Interaction deviation: the React version only reveals the rename/delete
/// icon buttons on `:hover` (`hidden group-hover:flex`), relying on mouse
/// hover. This port renders them always-visible instead: hover-only
/// affordances are a poor fit for touch/keyboard-first testing and desktop
/// accessibility, and the row is already compact enough that permanent
/// icons don't crowd it.
library;

import "package:flutter/material.dart";
import "package:flutter/services.dart";

import "../../models/workspace.dart";
import "../../theme/app_colors.dart";
import "../../theme/app_spacing.dart";
import "../../theme/app_typography.dart";
import "../atoms/ingestion_progress_badge.dart";

class SourceItem extends StatefulWidget {
  const SourceItem({
    super.key,
    required this.source,
    required this.active,
    required this.onTap,
    required this.onDelete,
    required this.onRename,
    this.isRenaming = false,
    this.onRenamingChanged,
    this.badgeStatus,
    this.progress = 0,
    this.queuePosition = 0,
  });

  final LogSource source;
  final bool active;
  final VoidCallback onTap;
  final VoidCallback onDelete;
  final ValueChanged<String> onRename;

  /// Controlled rename-mode flag (parent owns which row, if any, is being
  /// renamed -- mirrors the React `isRenaming`/`onRenamingChange` pair).
  final bool isRenaming;
  final ValueChanged<bool>? onRenamingChanged;

  /// Resolved ingestion badge state for this source (`null` = no active
  /// job / render nothing), and its progress ratio (0-1) / queue position.
  final IngestionStatus? badgeStatus;
  final double progress;
  final int queuePosition;

  @override
  State<SourceItem> createState() => _SourceItemState();
}

class _SourceItemState extends State<SourceItem> {
  late final TextEditingController _nameController = TextEditingController(text: widget.source.name);
  late final FocusNode _focusNode = FocusNode();

  @override
  void didUpdateWidget(covariant SourceItem oldWidget) {
    super.didUpdateWidget(oldWidget);
    if (widget.isRenaming && !oldWidget.isRenaming) {
      _nameController.text = widget.source.name;
      _nameController.selection = TextSelection(
        baseOffset: 0,
        extentOffset: _nameController.text.length,
      );
      WidgetsBinding.instance.addPostFrameCallback((_) {
        if (mounted) _focusNode.requestFocus();
      });
    }
  }

  @override
  void dispose() {
    _nameController.dispose();
    _focusNode.dispose();
    super.dispose();
  }

  void _confirmRename() {
    final trimmed = _nameController.text.trim();
    if (trimmed.isNotEmpty && trimmed != widget.source.name) {
      widget.onRename(trimmed);
    }
    widget.onRenamingChanged?.call(false);
  }

  @override
  Widget build(BuildContext context) {
    if (widget.isRenaming) {
      return Padding(
        padding: const EdgeInsets.symmetric(horizontal: AppSpacing.sm, vertical: 4),
        child: KeyboardListener(
          focusNode: FocusNode(skipTraversal: true),
          onKeyEvent: (event) {
            if (event is KeyDownEvent && event.logicalKey == LogicalKeyboardKey.escape) {
              widget.onRenamingChanged?.call(false);
            }
          },
          child: TextField(
            controller: _nameController,
            focusNode: _focusNode,
            autofocus: true,
            style: AppTypography.log.copyWith(fontSize: 11, color: AppColors.textPrimary),
            onSubmitted: (_) => _confirmRename(),
            onTapOutside: (_) => _confirmRename(),
            decoration: InputDecoration(
              isDense: true,
              filled: true,
              fillColor: AppColors.bgApp.withValues(alpha: 0.4),
              contentPadding: const EdgeInsets.symmetric(horizontal: 6, vertical: 4),
              border: OutlineInputBorder(
                borderRadius: BorderRadius.circular(4),
                borderSide: BorderSide(color: AppColors.primary.withValues(alpha: 0.3)),
              ),
              focusedBorder: OutlineInputBorder(
                borderRadius: BorderRadius.circular(4),
                borderSide: BorderSide(color: AppColors.primary.withValues(alpha: 0.4)),
              ),
            ),
          ),
        ),
      );
    }

    final fg = widget.active ? AppColors.primary : AppColors.textMuted;

    return Padding(
      padding: const EdgeInsets.symmetric(horizontal: 4, vertical: 2),
      child: Row(
        children: [
          Expanded(
            child: Material(
              color: widget.active
                  ? AppColors.primary.withValues(alpha: 0.05)
                  : Colors.transparent,
              borderRadius: BorderRadius.circular(4),
              child: InkWell(
                borderRadius: BorderRadius.circular(4),
                onTap: widget.onTap,
                child: Padding(
                  padding: const EdgeInsets.symmetric(horizontal: AppSpacing.sm, vertical: 6),
                  child: Row(
                    children: [
                      Icon(Icons.description_outlined, size: 14, color: fg),
                      const SizedBox(width: AppSpacing.sm),
                      Expanded(
                        child: Text(
                          widget.source.name,
                          overflow: TextOverflow.ellipsis,
                          style: AppTypography.log.copyWith(fontSize: 12, color: fg),
                        ),
                      ),
                      if (widget.badgeStatus != null) ...[
                        const SizedBox(width: AppSpacing.xs),
                        IngestionProgressBadge(
                          status: widget.badgeStatus!,
                          progress: widget.progress,
                          queuePosition: widget.queuePosition,
                        ),
                      ],
                    ],
                  ),
                ),
              ),
            ),
          ),
          IconButton(
            icon: const Icon(Icons.edit_outlined, size: 13),
            color: AppColors.textMuted,
            tooltip: "Rename",
            splashRadius: 14,
            constraints: const BoxConstraints(minWidth: 24, minHeight: 24),
            padding: EdgeInsets.zero,
            onPressed: () => widget.onRenamingChanged?.call(true),
          ),
          IconButton(
            icon: const Icon(Icons.delete_outline, size: 13),
            color: AppColors.error.withValues(alpha: 0.8),
            tooltip: "Delete",
            splashRadius: 14,
            constraints: const BoxConstraints(minWidth: 24, minHeight: 24),
            padding: EdgeInsets.zero,
            onPressed: widget.onDelete,
          ),
        ],
      ),
    );
  }
}
