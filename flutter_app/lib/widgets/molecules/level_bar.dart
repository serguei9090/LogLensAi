/// Dart port of `src/components/molecules/LevelBar.tsx`.
///
/// Horizontal proportion bar for a single log level: a label + raw count
/// row above an animated fill bar showing `count / total` as a percentage.
library;

import "package:flutter/material.dart";

import "../../theme/app_colors.dart";
import "../../theme/app_typography.dart";

/// LevelBar's own level->color mapping is intentionally distinct from
/// [AppColors.forLogLevel]: INFO renders in the primary green (not the sky
/// "info" color) and CRITICAL renders in violet/debug (not red), matching
/// the `colors` record literal in the original React component exactly.
Color _levelBarColor(String level) {
  switch (level.toUpperCase()) {
    case "ERROR":
    case "FATAL":
      return AppColors.error;
    case "WARN":
    case "WARNING":
      return AppColors.warning;
    case "INFO":
      return AppColors.primary;
    case "DEBUG":
      return AppColors.info;
    case "CRITICAL":
      return AppColors.debug;
    default:
      return AppColors.textMuted;
  }
}

class LevelBar extends StatelessWidget {
  const LevelBar({super.key, required this.level, required this.count, required this.total});

  final String level;
  final int count;
  final int total;

  @override
  Widget build(BuildContext context) {
    final pct = total > 0 ? (count / total * 100).clamp(0, 100).toDouble() : 0.0;
    final color = _levelBarColor(level);

    return Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        Row(
          crossAxisAlignment: CrossAxisAlignment.end,
          mainAxisAlignment: MainAxisAlignment.spaceBetween,
          children: [
            Text(
              level.toUpperCase(),
              style: AppTypography.labelCaps.copyWith(color: AppColors.textPrimary),
            ),
            Container(
              padding: const EdgeInsets.symmetric(horizontal: 6, vertical: 2),
              decoration: BoxDecoration(
                color: AppColors.bgBase.withValues(alpha: 0.5),
                borderRadius: BorderRadius.circular(4),
                border: Border.all(color: AppColors.border.withValues(alpha: 0.3)),
              ),
              child: Text(
                _formatCount(count),
                style: AppTypography.log.copyWith(fontSize: 10, color: AppColors.textMuted),
              ),
            ),
          ],
        ),
        const SizedBox(height: 6),
        ClipRRect(
          borderRadius: BorderRadius.circular(999),
          child: Container(
            height: 8,
            decoration: BoxDecoration(
              color: AppColors.bgSurfaceBright,
              border: Border.all(color: Colors.white.withValues(alpha: 0.05)),
              borderRadius: BorderRadius.circular(999),
            ),
            child: Align(
              alignment: Alignment.centerLeft,
              child: TweenAnimationBuilder<double>(
                tween: Tween(begin: 0, end: pct),
                duration: const Duration(milliseconds: 800),
                curve: Curves.easeOut,
                builder: (context, value, child) {
                  return FractionallySizedBox(
                    widthFactor: value / 100,
                    child: Container(
                      decoration: BoxDecoration(
                        color: color,
                        borderRadius: BorderRadius.circular(999),
                        boxShadow: [
                          BoxShadow(color: color.withValues(alpha: 0.3), blurRadius: 8),
                        ],
                      ),
                    ),
                  );
                },
              ),
            ),
          ),
        ),
      ],
    );
  }

  static String _formatCount(int count) {
    // Mirrors `count.toLocaleString()` (thousands separators, en-US style).
    final s = count.toString();
    final buf = StringBuffer();
    for (var i = 0; i < s.length; i++) {
      if (i > 0 && (s.length - i) % 3 == 0) buf.write(",");
      buf.write(s[i]);
    }
    return buf.toString();
  }
}
