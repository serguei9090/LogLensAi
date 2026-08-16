import "package:flutter/material.dart";

import "../../theme/app_theme.dart";
import "src/pulse_animations.dart";

/// Pill-style "Live Tail" toggle with a pulsing dot when active.
///
/// Port of `src/components/atoms/TailSwitch.tsx` (see the co-located
/// `TailSwitch.test.tsx` for the exact expected behavior: renders the
/// [label] text, exposes a `switch` semantics role with `checked` state,
/// and calls [onChanged] with the flipped value on tap).
///
/// Color mapping deviation: the React version hardcodes Tailwind
/// `emerald-*`/`zinc-*` swatches rather than using the app's own CSS
/// variables. Per this port's "no hardcoded hex, `AppColors` only" rule,
/// the checked state maps to [AppColors.primary]/[AppColors.primaryMuted]
/// and the unchecked state maps to [AppColors.border]/[AppColors.bgSurface]
/// /[AppColors.textSecondary] — the closest semantic equivalents.
class TailSwitch extends StatelessWidget {
  const TailSwitch({
    super.key,
    required this.checked,
    required this.onChanged,
    this.label = "Tail",
    this.disabled = false,
  });

  final bool checked;
  final ValueChanged<bool> onChanged;
  final String label;
  final bool disabled;

  @override
  Widget build(BuildContext context) {
    final fg = checked ? AppColors.primary : AppColors.textSecondary;
    final bg = checked ? AppColors.primaryMuted.withValues(alpha: 0.6) : AppColors.bgSurface;
    final border = checked ? AppColors.primary.withValues(alpha: 0.4) : AppColors.border;
    final dotColor = checked ? AppColors.primary : AppColors.textMuted;

    return Opacity(
      opacity: disabled ? 0.5 : 1,
      child: MouseRegion(
        cursor: disabled ? SystemMouseCursors.forbidden : SystemMouseCursors.click,
        child: Semantics(
          toggled: checked,
          enabled: !disabled,
          button: true,
          label: label,
          child: GestureDetector(
            onTap: disabled ? null : () => onChanged(!checked),
            child: Container(
              padding: const EdgeInsets.symmetric(horizontal: AppSpacing.sm, vertical: 4),
              decoration: BoxDecoration(
                color: bg,
                borderRadius: BorderRadius.circular(AppRadius.xl),
                border: Border.all(color: border),
                boxShadow: checked
                    ? [BoxShadow(color: AppColors.primary.withValues(alpha: 0.15), blurRadius: 12)]
                    : null,
              ),
              child: Row(
                mainAxisSize: MainAxisSize.min,
                children: [
                  SizedBox(
                    width: 8,
                    height: 8,
                    child: Stack(
                      alignment: Alignment.center,
                      children: [
                        if (checked) PingDot(color: AppColors.primary, size: 8),
                        Container(
                          width: 8,
                          height: 8,
                          decoration: BoxDecoration(color: dotColor, shape: BoxShape.circle),
                        ),
                      ],
                    ),
                  ),
                  const SizedBox(width: AppSpacing.sm),
                  Text(
                    label,
                    style: AppTypography.body.copyWith(
                      fontSize: 12,
                      fontWeight: FontWeight.w600,
                      color: fg,
                    ),
                  ),
                ],
              ),
            ),
          ),
        ),
      ),
    );
  }
}
