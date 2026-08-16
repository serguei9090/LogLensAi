/// Dart port of `src/components/molecules/DashboardModeToggle.tsx`.
///
/// Floating pill-shaped segmented control for switching the Dashboard page
/// between "Static" (charts/KPIs) and "AI Insights" mode. The React version
/// is `position: absolute` (bottom-center overlay); this widget renders just
/// the pill itself -- callers that want the floating placement wrap it in a
/// `Positioned`/`Align` inside a `Stack`, since standalone widgets shouldn't
/// assume they're inside a `Stack` (this one is also more convenient to
/// widget-test un-positioned).
library;

import "package:flutter/material.dart";

import "../../theme/app_theme.dart";

/// Mirrors the TS `DashboardMode = "static" | "ai"` union. `staticMode` is
/// used instead of `static` since that's a reserved word in Dart.
enum DashboardMode { staticMode, ai }

class DashboardModeToggle extends StatelessWidget {
  const DashboardModeToggle({super.key, required this.mode, required this.onModeChange});

  final DashboardMode mode;
  final ValueChanged<DashboardMode> onModeChange;

  @override
  Widget build(BuildContext context) {
    return DecoratedBox(
      decoration: BoxDecoration(
        color: AppColors.bgSurface.withValues(alpha: 0.8),
        border: Border.all(color: AppColors.border.withValues(alpha: 0.5)),
        borderRadius: BorderRadius.circular(999),
        boxShadow: const [BoxShadow(color: Color(0x66000000), blurRadius: 32)],
      ),
      child: Padding(
        padding: const EdgeInsets.all(6),
        child: Row(
          mainAxisSize: MainAxisSize.min,
          children: [
            _ToggleButton(
              active: mode == DashboardMode.staticMode,
              onTap: () => onModeChange(DashboardMode.staticMode),
              icon: Icons.bar_chart_rounded,
              label: "Static",
              activeColor: AppColors.primary,
            ),
            _ToggleButton(
              active: mode == DashboardMode.ai,
              onTap: () => onModeChange(DashboardMode.ai),
              icon: Icons.auto_awesome,
              label: "AI Insights",
              activeColor: AppColors.debug,
            ),
          ],
        ),
      ),
    );
  }
}

class _ToggleButton extends StatelessWidget {
  const _ToggleButton({
    required this.active,
    required this.onTap,
    required this.icon,
    required this.label,
    required this.activeColor,
  });

  final bool active;
  final VoidCallback onTap;
  final IconData icon;
  final String label;
  final Color activeColor;

  @override
  Widget build(BuildContext context) {
    final fg = active ? AppColors.textInverse : AppColors.textMuted;
    return Material(
      color: active ? activeColor : Colors.transparent,
      borderRadius: BorderRadius.circular(999),
      child: InkWell(
        onTap: onTap,
        borderRadius: BorderRadius.circular(999),
        child: Padding(
          padding: const EdgeInsets.symmetric(horizontal: AppSpacing.md, vertical: AppSpacing.sm),
          child: Row(
            mainAxisSize: MainAxisSize.min,
            children: [
              Icon(icon, size: 16, color: fg),
              const SizedBox(width: AppSpacing.xs),
              Text(
                label,
                style: AppTypography.labelCaps.copyWith(color: fg, letterSpacing: 0),
              ),
            ],
          ),
        ),
      ),
    );
  }
}
