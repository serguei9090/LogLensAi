/// Dart port of `src/components/organisms/AIHistorySearchModal.tsx`.
///
/// Full-text (by-name) search over past AI investigation sessions
/// (`aiProvider.sessions`), with select-to-open and per-row delete.
///
/// Deviation from the React source: the React version is a Radix `Dialog`
/// mounted directly by its parent with `open`/`onOpenChange` props. This
/// port instead exposes a static [AIHistorySearchModal.show] that wraps
/// [showDialog] (matching this codebase's [ConfirmationDialog]/
/// [AddColumnModal] convention), plus a plain constructor taking [onClose]
/// so the dialog content itself stays trivially widget-testable without a
/// pushed route.
library;

import "package:flutter/material.dart";
import "package:flutter_riverpod/flutter_riverpod.dart";

import "../../models/ai_session.dart";
import "../../providers/ai_provider.dart";
import "../../providers/workspace_provider.dart";
import "../../theme/app_theme.dart";

class AIHistorySearchModal extends ConsumerStatefulWidget {
  const AIHistorySearchModal({super.key, required this.onClose});

  final VoidCallback onClose;

  /// Batteries-included call site helper: shows this dialog and pops the
  /// route automatically when a session is selected or closed.
  static Future<void> show(BuildContext context) {
    return showDialog<void>(
      context: context,
      builder: (dialogContext) =>
          AIHistorySearchModal(onClose: () => Navigator.of(dialogContext).pop()),
    );
  }

  @override
  ConsumerState<AIHistorySearchModal> createState() => _AIHistorySearchModalState();
}

class _AIHistorySearchModalState extends ConsumerState<AIHistorySearchModal> {
  final _searchController = TextEditingController();
  String _query = "";

  @override
  void dispose() {
    _searchController.dispose();
    super.dispose();
  }

  void _handleSelect(String sessionId) {
    final aiNotifier = ref.read(aiProvider.notifier);
    aiNotifier.setSession(sessionId);
    aiNotifier.setSidebarOpen(true);
    widget.onClose();
  }

  @override
  Widget build(BuildContext context) {
    final aiState = ref.watch(aiProvider);
    final activeWorkspaceId = ref.watch(workspaceProvider).activeWorkspaceId;

    final filtered = aiState.sessions
        .where((s) => s.name.toLowerCase().contains(_query.toLowerCase()))
        .toList();

    return Dialog(
      backgroundColor: AppColors.bgSurfaceBright.withValues(alpha: 0.95),
      shape: RoundedRectangleBorder(
        borderRadius: BorderRadius.circular(AppRadius.lg),
        side: BorderSide(color: AppColors.border.withValues(alpha: 0.6)),
      ),
      child: ConstrainedBox(
        constraints: const BoxConstraints(maxWidth: 640, maxHeight: 560),
        child: Column(
          mainAxisSize: MainAxisSize.min,
          children: [
            Padding(
              padding: const EdgeInsets.all(AppSpacing.md),
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  Row(
                    children: [
                      const Icon(Icons.search, size: 12, color: AppColors.textMuted),
                      const SizedBox(width: AppSpacing.xs),
                      Text(
                        "SEARCH INVESTIGATIONS",
                        style: AppTypography.labelCaps,
                      ),
                    ],
                  ),
                  const SizedBox(height: AppSpacing.md),
                  TextField(
                    controller: _searchController,
                    autofocus: true,
                    decoration: const InputDecoration(
                      prefixIcon: Icon(Icons.search, size: 18),
                      hintText: "Filter by name or keywords...",
                      isDense: true,
                    ),
                    onChanged: (v) => setState(() => _query = v),
                  ),
                ],
              ),
            ),
            const Divider(height: 1),
            Flexible(
              child: filtered.isEmpty
                  ? Padding(
                      padding: const EdgeInsets.all(AppSpacing.xl),
                      child: Text(
                        "No matching investigations found.",
                        style: AppTypography.body.copyWith(
                          color: AppColors.textMuted,
                          fontStyle: FontStyle.italic,
                        ),
                        textAlign: TextAlign.center,
                      ),
                    )
                  : ListView.builder(
                      shrinkWrap: true,
                      padding: const EdgeInsets.all(AppSpacing.sm),
                      itemCount: filtered.length,
                      itemBuilder: (context, i) {
                        final session = filtered[i];
                        final isActive = aiState.currentSessionId == session.sessionId;
                        return _SessionRow(
                          session: session,
                          isActive: isActive,
                          onSelect: () => _handleSelect(session.sessionId),
                          onDelete: activeWorkspaceId.isEmpty
                              ? null
                              : () => ref
                                    .read(aiProvider.notifier)
                                    .deleteSession(session.sessionId, activeWorkspaceId),
                        );
                      },
                    ),
            ),
            const Divider(height: 1),
            Padding(
              padding: const EdgeInsets.symmetric(
                horizontal: AppSpacing.md,
                vertical: AppSpacing.sm,
              ),
              child: Row(
                mainAxisAlignment: MainAxisAlignment.spaceBetween,
                children: [
                  Text(
                    "${filtered.length} sessions found".toUpperCase(),
                    style: AppTypography.labelCaps,
                  ),
                  Row(
                    mainAxisSize: MainAxisSize.min,
                    children: [
                      _KbdHint("ESC"),
                      const SizedBox(width: AppSpacing.xs),
                      Text(
                        "to close",
                        style: AppTypography.body.copyWith(
                          fontSize: 10,
                          color: AppColors.textMuted,
                        ),
                      ),
                    ],
                  ),
                ],
              ),
            ),
          ],
        ),
      ),
    );
  }
}

class _SessionRow extends StatelessWidget {
  const _SessionRow({
    required this.session,
    required this.isActive,
    required this.onSelect,
    required this.onDelete,
  });

  final AiSession session;
  final bool isActive;
  final VoidCallback onSelect;
  final VoidCallback? onDelete;

  @override
  Widget build(BuildContext context) {
    final lastModified = DateTime.tryParse(session.lastModified);
    return Padding(
      padding: const EdgeInsets.symmetric(vertical: 2),
      child: Material(
        color: isActive ? AppColors.primary.withValues(alpha: 0.1) : Colors.transparent,
        borderRadius: BorderRadius.circular(AppRadius.md),
        child: InkWell(
          borderRadius: BorderRadius.circular(AppRadius.md),
          onTap: onSelect,
          child: Padding(
            padding: const EdgeInsets.all(AppSpacing.sm),
            child: Row(
              children: [
                Expanded(
                  child: Column(
                    crossAxisAlignment: CrossAxisAlignment.start,
                    children: [
                      Text(
                        session.name,
                        maxLines: 1,
                        overflow: TextOverflow.ellipsis,
                        style: AppTypography.body.copyWith(
                          fontWeight: FontWeight.w600,
                          color: isActive ? AppColors.primary : AppColors.textPrimary,
                        ),
                      ),
                      const SizedBox(height: 4),
                      if (lastModified != null)
                        Row(
                          mainAxisSize: MainAxisSize.min,
                          children: [
                            const Icon(Icons.calendar_today, size: 10, color: AppColors.textMuted),
                            const SizedBox(width: 4),
                            Text(
                              "${lastModified.year}-${lastModified.month.toString().padLeft(2, '0')}-${lastModified.day.toString().padLeft(2, '0')}",
                              style: AppTypography.body.copyWith(
                                fontSize: 10,
                                color: AppColors.textMuted,
                              ),
                            ),
                            const SizedBox(width: AppSpacing.sm),
                            Text(
                              "${lastModified.hour.toString().padLeft(2, '0')}:${lastModified.minute.toString().padLeft(2, '0')}",
                              style: AppTypography.body.copyWith(
                                fontSize: 10,
                                color: AppColors.textMuted,
                              ),
                            ),
                          ],
                        ),
                    ],
                  ),
                ),
                if (onDelete != null)
                  IconButton(
                    icon: const Icon(Icons.delete_outline, size: 16),
                    tooltip: "Delete investigation",
                    color: AppColors.textMuted,
                    onPressed: onDelete,
                  ),
              ],
            ),
          ),
        ),
      ),
    );
  }
}

class _KbdHint extends StatelessWidget {
  const _KbdHint(this.text);
  final String text;

  @override
  Widget build(BuildContext context) {
    return Container(
      padding: const EdgeInsets.symmetric(horizontal: 6, vertical: 2),
      decoration: BoxDecoration(
        color: AppColors.bgSurfaceBright,
        borderRadius: BorderRadius.circular(AppRadius.sm),
        border: Border.all(color: AppColors.border),
      ),
      child: Text(
        text,
        style: AppTypography.log.copyWith(fontSize: 10, color: AppColors.textPrimary),
      ),
    );
  }
}
