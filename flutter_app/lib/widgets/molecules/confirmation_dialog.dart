/// Dart port of `src/components/molecules/ConfirmationDialog.tsx`.
///
/// Generic yes/no confirmation dialog (delete workspace, delete folder,
/// delete source, etc.). Deliberately kept dumb/reusable: the plain
/// [ConfirmationDialog] widget itself never touches [Navigator] -- it only
/// invokes [onConfirm] / [onCancel] -- so it can be pumped directly in a
/// widget test without a pushed dialog route. [ConfirmationDialog.show] is
/// the batteries-included convenience for real call sites: it wraps
/// [showDialog] and pops the route for you before forwarding to the
/// caller's [onConfirm].
library;

import "package:flutter/material.dart";

import "../../theme/app_theme.dart";

/// Mirrors the TS `variant?: "default" | "destructive"` union. `standard`
/// is used instead of `default` since that's a reserved word in Dart.
enum ConfirmationVariant { standard, destructive }

class ConfirmationDialog extends StatelessWidget {
  const ConfirmationDialog({
    super.key,
    required this.title,
    required this.description,
    required this.onConfirm,
    this.onCancel,
    this.confirmText = "Confirm",
    this.variant = ConfirmationVariant.standard,
  });

  final String title;
  final String description;

  /// Fired when the confirm button is tapped. Callers using the plain
  /// constructor (rather than [show]) are responsible for dismissing any
  /// dialog route themselves.
  final VoidCallback onConfirm;

  /// Fired when the cancel button (or, via [show], a scrim tap) dismisses
  /// the dialog without confirming. Optional since some embeddings (e.g.
  /// inline within another dialog's delete-target flow) only care about
  /// [onConfirm] and manage visibility externally.
  final VoidCallback? onCancel;
  final String confirmText;
  final ConfirmationVariant variant;

  /// Convenience wrapper: shows this dialog via [showDialog] and pops the
  /// route automatically on either button, in addition to forwarding to
  /// [onConfirm]/[onCancel]. This is the reusable "just call this" entry
  /// point most call sites (delete workspace, delete folder, ...) want.
  static Future<void> show(
    BuildContext context, {
    required String title,
    required String description,
    required VoidCallback onConfirm,
    VoidCallback? onCancel,
    String confirmText = "Confirm",
    ConfirmationVariant variant = ConfirmationVariant.standard,
  }) {
    return showDialog<void>(
      context: context,
      builder: (dialogContext) => ConfirmationDialog(
        title: title,
        description: description,
        confirmText: confirmText,
        variant: variant,
        onConfirm: () {
          Navigator.of(dialogContext).pop();
          onConfirm();
        },
        onCancel: () {
          Navigator.of(dialogContext).pop();
          onCancel?.call();
        },
      ),
    );
  }

  @override
  Widget build(BuildContext context) {
    final isDestructive = variant == ConfirmationVariant.destructive;
    final accent = isDestructive ? AppColors.error : AppColors.primary;

    return Dialog(
      backgroundColor: AppColors.bgSurfaceBright,
      shape: RoundedRectangleBorder(
        borderRadius: BorderRadius.circular(AppRadius.lg),
        side: const BorderSide(color: AppColors.borderSubtle),
      ),
      child: ConstrainedBox(
        constraints: const BoxConstraints(maxWidth: 425),
        child: Padding(
          padding: const EdgeInsets.all(AppSpacing.lg),
          child: Column(
            mainAxisSize: MainAxisSize.min,
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              Row(
                crossAxisAlignment: CrossAxisAlignment.center,
                children: [
                  Container(
                    padding: const EdgeInsets.all(AppSpacing.sm),
                    decoration: BoxDecoration(
                      color: accent.withValues(alpha: 0.1),
                      shape: BoxShape.circle,
                    ),
                    child: Icon(Icons.warning_amber_rounded, color: accent, size: 20),
                  ),
                  const SizedBox(width: AppSpacing.sm),
                  Expanded(
                    child: Text(
                      title,
                      style: AppTypography.h1.copyWith(fontSize: 18),
                    ),
                  ),
                ],
              ),
              const SizedBox(height: AppSpacing.sm),
              Text(
                description,
                style: AppTypography.body.copyWith(color: AppColors.textSecondary, height: 1.5),
              ),
              const SizedBox(height: AppSpacing.lg),
              Row(
                mainAxisAlignment: MainAxisAlignment.end,
                children: [
                  // Flexible (rather than bare buttons) -- some call sites
                  // pass longer confirm text (e.g. "Reset Everything") that
                  // doesn't reliably fit both buttons within the 425px
                  // dialog width at once; this lets a long label's button
                  // shrink/wrap instead of forcing a hard RenderFlex
                  // overflow.
                  Flexible(
                    child: OutlinedButton(
                      onPressed: onCancel,
                      child: const Text("Cancel"),
                    ),
                  ),
                  const SizedBox(width: AppSpacing.sm),
                  Flexible(
                    child: ElevatedButton(
                      onPressed: onConfirm,
                      style: ElevatedButton.styleFrom(
                        backgroundColor: accent,
                        foregroundColor: AppColors.textInverse,
                      ),
                      child: Text(confirmText, overflow: TextOverflow.ellipsis),
                    ),
                  ),
                ],
              ),
            ],
          ),
        ),
      ),
    );
  }
}
