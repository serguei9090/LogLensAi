import "package:flutter/material.dart";

import "../../theme/app_theme.dart";

/// Colored pill badge for a log level (DEBUG/INFO/WARN/ERROR/...).
///
/// Port of `src/components/atoms/LogLevelBadge.tsx`. The React version hand
/// -rolls a solid-background/inverse-text style per level (plus a one-off
/// glow for FATAL). Per the Flutter port's style rule ("use
/// `AppColors.forLogLevel()`/`bgForLogLevel()`, don't reimplement the color
/// mapping"), this instead renders the translucent-background/colored-text
/// pill style already established by those two helpers — a deliberate
/// visual deviation from the React source in exchange for reusing the
/// theme-layer's single source of truth for level colors. FATAL keeps a
/// subtle glow to preserve the "this one is scarier" affordance.
class LogLevelBadge extends StatelessWidget {
  const LogLevelBadge({super.key, required this.level});

  /// Log level string, e.g. "ERROR", "WARN", "INFO", "DEBUG" (case
  /// -insensitive, matches [AppColors.forLogLevel]'s accepted set).
  final String level;

  @override
  Widget build(BuildContext context) {
    final upper = level.toUpperCase();
    final fg = AppColors.forLogLevel(upper);
    final bg = AppColors.bgForLogLevel(upper);
    final isFatal = upper == "FATAL";

    return Container(
      padding: const EdgeInsets.symmetric(horizontal: AppSpacing.sm, vertical: 2),
      decoration: BoxDecoration(
        color: bg,
        borderRadius: BorderRadius.circular(AppRadius.sm),
        border: Border.all(color: fg.withValues(alpha: 0.5)),
        boxShadow: isFatal
            ? [BoxShadow(color: fg.withValues(alpha: 0.5), blurRadius: 10)]
            : null,
      ),
      child: Text(
        upper,
        style: AppTypography.labelCaps.copyWith(color: fg, height: 1),
      ),
    );
  }
}
