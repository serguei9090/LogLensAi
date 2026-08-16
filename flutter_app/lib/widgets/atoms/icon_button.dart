import "package:flutter/material.dart";

import "../../theme/app_theme.dart";

/// Icon-only button primitive with theme-consistent sizing/hover states and
/// a mandatory accessible tooltip.
///
/// Port of `src/components/atoms/IconButton.tsx`. The React version wraps a
/// ghost-variant shadcn Button in a Radix tooltip trigger to avoid nesting a
/// `<button>` inside a `<button>`. Flutter's [IconButton] already ships with
/// a built-in `tooltip` param backed by the same [Tooltip] widget used
/// elsewhere in this port, so this is a themed convenience constructor
/// around it rather than a reimplementation.
class AppIconButton extends StatelessWidget {
  const AppIconButton({
    super.key,
    required this.icon,
    required this.tooltip,
    required this.onPressed,
    this.size = 18,
    this.color,
  });

  /// Icon to display (React's `icon: ReactNode` narrows to `IconData` here).
  final IconData icon;

  /// Accessible label, also shown as the hover/long-press tooltip.
  final String tooltip;

  /// Tap handler. Passing `null` disables the button (matches
  /// [IconButton]'s built-in disabled styling).
  final VoidCallback? onPressed;

  /// Icon size in logical pixels.
  final double size;

  /// Icon color override. Defaults to [AppColors.textSecondary], matching
  /// the ghost-variant default used throughout the sidebar/toolbar chrome.
  final Color? color;

  @override
  Widget build(BuildContext context) {
    final fg = color ?? AppColors.textSecondary;
    return IconButton(
      icon: Icon(icon, size: size),
      tooltip: tooltip,
      onPressed: onPressed,
      style: IconButton.styleFrom(
        foregroundColor: fg,
        disabledForegroundColor: AppColors.textMuted.withValues(alpha: 0.4),
        hoverColor: AppColors.bgHover,
        highlightColor: Colors.transparent,
        splashFactory: NoSplash.splashFactory,
        minimumSize: const Size(32, 32),
        padding: const EdgeInsets.all(AppSpacing.xs),
        shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(AppRadius.md)),
      ),
    );
  }
}
