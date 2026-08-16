import "package:flutter/material.dart";

import "../../theme/app_theme.dart";

/// Single sidebar navigation row (icon + label), used in the sidebar
/// footer/rail.
///
/// Port of `src/components/atoms/SidebarNavItem.tsx`. When [collapsed] is
/// true, the label is hidden and the whole row is wrapped in a [Tooltip]
/// showing "label (badge)" — matching the React version's collapsed-rail
/// behavior.
class SidebarNavItem extends StatelessWidget {
  const SidebarNavItem({
    super.key,
    required this.icon,
    required this.label,
    required this.active,
    required this.collapsed,
    this.onTap,
    this.disabled = false,
    this.badge,
  });

  final Widget icon;
  final String label;
  final bool active;
  final bool collapsed;
  final VoidCallback? onTap;
  final bool disabled;
  final String? badge;

  @override
  Widget build(BuildContext context) {
    final content = _buildRow(context);
    if (collapsed) {
      return Tooltip(
        message: badge != null ? "$label ($badge)" : label,
        child: content,
      );
    }
    return content;
  }

  Widget _buildRow(BuildContext context) {
    final effectiveDisabled = disabled || active;
    final fg = active
        ? AppColors.primary
        : (disabled ? AppColors.textMuted : AppColors.textSecondary);

    return Opacity(
      opacity: disabled ? 0.4 : 1,
      child: Material(
        color: active ? AppColors.primary.withValues(alpha: 0.1) : Colors.transparent,
        borderRadius: BorderRadius.circular(AppRadius.md),
        child: InkWell(
          onTap: effectiveDisabled ? null : onTap,
          borderRadius: BorderRadius.circular(AppRadius.md),
          hoverColor: active ? Colors.transparent : AppColors.bgHover,
          child: Container(
            padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 10),
            decoration: BoxDecoration(
              borderRadius: BorderRadius.circular(AppRadius.md),
              border: active
                  ? Border.all(color: AppColors.primary.withValues(alpha: 0.2))
                  : null,
            ),
            child: Row(
              mainAxisSize: collapsed ? MainAxisSize.min : MainAxisSize.max,
              mainAxisAlignment: collapsed ? MainAxisAlignment.center : MainAxisAlignment.start,
              children: [
                // Flexible (rather than a bare IconTheme) so this row
                // degrades gracefully -- instead of a hard RenderFlex
                // overflow -- during the sidebar's ~220ms collapse/expand
                // width transition, where `collapsed` (driving this row's
                // whole layout) flips instantly but the host
                // AnimatedContainer's width hasn't caught up yet.
                Flexible(
                  child: IconTheme(
                    data: IconThemeData(color: fg, size: 16),
                    child: icon,
                  ),
                ),
                if (!collapsed) ...[
                  const SizedBox(width: AppSpacing.sm),
                  Expanded(
                    child: Text(
                      label,
                      overflow: TextOverflow.ellipsis,
                      maxLines: 1,
                      style: AppTypography.body.copyWith(
                        fontSize: 13,
                        color: fg,
                        fontWeight: active ? FontWeight.w600 : FontWeight.w400,
                      ),
                    ),
                  ),
                  if (badge != null) ...[
                    const SizedBox(width: AppSpacing.xs),
                    Container(
                      padding: const EdgeInsets.symmetric(horizontal: 4, vertical: 1),
                      decoration: BoxDecoration(
                        color: AppColors.bgSurfaceBright,
                        border: Border.all(color: AppColors.border),
                        borderRadius: BorderRadius.circular(3),
                      ),
                      child: Text(
                        badge!,
                        style: TextStyle(color: AppColors.textMuted, fontSize: 8, height: 1),
                      ),
                    ),
                  ],
                ],
              ],
            ),
          ),
        ),
      ),
    );
  }
}
