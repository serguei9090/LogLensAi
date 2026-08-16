import "package:flutter/material.dart";

import "../../theme/app_theme.dart";

/// Small "?"-icon with a hover/tap tooltip.
///
/// Port of `src/components/atoms/HelpTooltip.tsx`. Uses Flutter's built-in
/// [Tooltip] (which already handles hover-on-desktop + long-press-on-touch)
/// wrapping a [HelpOutline] icon. The React version brightens the icon on
/// hover (`text-text-muted hover:text-text-primary`); reproduced here with a
/// [MouseRegion] since [Tooltip] alone doesn't expose hover state.
class HelpTooltip extends StatefulWidget {
  const HelpTooltip({super.key, required this.message, this.size = 16});

  /// Tooltip body text.
  final String message;

  /// Icon size in logical pixels. React version is `h-4 w-4` (16px).
  final double size;

  @override
  State<HelpTooltip> createState() => _HelpTooltipState();
}

class _HelpTooltipState extends State<HelpTooltip> {
  bool _hovered = false;

  @override
  Widget build(BuildContext context) {
    return MouseRegion(
      cursor: SystemMouseCursors.help,
      onEnter: (_) => setState(() => _hovered = true),
      onExit: (_) => setState(() => _hovered = false),
      child: Tooltip(
        message: widget.message,
        child: Icon(
          Icons.help_outline,
          size: widget.size,
          color: _hovered ? AppColors.textPrimary : AppColors.textMuted,
        ),
      ),
    );
  }
}
