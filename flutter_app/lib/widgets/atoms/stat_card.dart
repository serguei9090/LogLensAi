import "package:flutter/material.dart";

import "../../theme/app_theme.dart";

/// Trend direction for a [StatCard], mirrors the TS `"up" | "down" |
/// "stable"` union.
enum StatTrend { up, down, stable }

/// Dashboard KPI tile (icon, label, value, sub-value, optional trend).
///
/// Port of `src/components/atoms/StatCard.tsx`. Matches the "Total Index" /
/// "Patterns" / etc. tiles on the Dashboard page. `trend == up` is styled
/// as [AppColors.error] (red) and `down` as [AppColors.primary] (green) —
/// that inversion is intentional and copied verbatim from the React source
/// (an "up" trend in error-rate-style metrics is bad news).
class StatCard extends StatelessWidget {
  const StatCard({
    super.key,
    required this.icon,
    required this.label,
    required this.value,
    required this.subValue,
    this.trend,
    this.loading = false,
  });

  final Widget icon;
  final String label;
  final String value;
  final String subValue;
  final StatTrend? trend;
  final bool loading;

  @override
  Widget build(BuildContext context) {
    Color trendColor = AppColors.textMuted.withValues(alpha: 0.4);
    String trendSymbol = "•";
    if (trend == StatTrend.up) {
      trendColor = AppColors.error;
      trendSymbol = "↑";
    } else if (trend == StatTrend.down) {
      trendColor = AppColors.primary;
      trendSymbol = "↓";
    }

    return Container(
      padding: const EdgeInsets.all(AppSpacing.md),
      decoration: BoxDecoration(
        color: AppColors.bgSurface.withValues(alpha: 0.4),
        border: Border.all(color: Colors.white.withValues(alpha: 0.05)),
        borderRadius: BorderRadius.circular(AppRadius.xl),
      ),
      child: Row(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Expanded(
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Text(
                  label.toUpperCase(),
                  style: AppTypography.labelCaps.copyWith(color: AppColors.textMuted),
                ),
                const SizedBox(height: 4),
                Row(
                  crossAxisAlignment: CrossAxisAlignment.baseline,
                  textBaseline: TextBaseline.alphabetic,
                  children: [
                    if (loading)
                      Container(
                        width: 64,
                        height: 22,
                        margin: const EdgeInsets.symmetric(vertical: 2),
                        decoration: BoxDecoration(
                          color: Colors.white.withValues(alpha: 0.1),
                          borderRadius: BorderRadius.circular(AppRadius.sm),
                        ),
                      )
                    else
                      Text(
                        value,
                        style: AppTypography.monoBody.copyWith(
                          fontSize: 20,
                          fontWeight: FontWeight.w700,
                        ),
                      ),
                    if (trend != null && !loading) ...[
                      const SizedBox(width: AppSpacing.xs),
                      Text(
                        trendSymbol,
                        style: TextStyle(color: trendColor, fontSize: 10, fontWeight: FontWeight.w700),
                      ),
                    ],
                  ],
                ),
                const SizedBox(height: 6),
                if (loading)
                  Container(
                    width: 96,
                    height: 10,
                    decoration: BoxDecoration(
                      color: Colors.white.withValues(alpha: 0.05),
                      borderRadius: BorderRadius.circular(AppRadius.sm),
                    ),
                  )
                else
                  Text(
                    subValue.toUpperCase(),
                    style: TextStyle(
                      color: AppColors.textMuted.withValues(alpha: 0.6),
                      fontSize: 9,
                      fontWeight: FontWeight.w600,
                    ),
                  ),
              ],
            ),
          ),
          const SizedBox(width: AppSpacing.sm),
          Container(
            padding: const EdgeInsets.all(AppSpacing.sm),
            decoration: BoxDecoration(
              color: AppColors.bgBase.withValues(alpha: 0.5),
              border: Border.all(color: Colors.white.withValues(alpha: 0.05)),
              borderRadius: BorderRadius.circular(AppRadius.md),
            ),
            child: icon,
          ),
        ],
      ),
    );
  }
}
