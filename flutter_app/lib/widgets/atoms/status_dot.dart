import "package:flutter/material.dart";

import "../../theme/app_theme.dart";
import "src/pulse_animations.dart";

/// Small colored connectivity/status dot.
///
/// Port of `src/components/atoms/StatusDot.tsx`. When [active] is true, a
/// [PingDot] pulses outward behind the solid dot (Tailwind's
/// `animate-ping`), mirroring the "live connection" affordance used next to
/// e.g. the sidecar health indicator.
class StatusDot extends StatelessWidget {
  const StatusDot({super.key, required this.active, this.size = 12});

  /// Whether the represented connection/status is active/healthy.
  final bool active;

  /// Diameter in logical pixels. React version is a fixed `h-3 w-3` (12px).
  final double size;

  @override
  Widget build(BuildContext context) {
    final color = active ? AppColors.primary : AppColors.border;
    return SizedBox(
      width: size,
      height: size,
      child: Stack(
        alignment: Alignment.center,
        children: [
          if (active) PingDot(color: AppColors.primary, size: size),
          Container(
            width: size,
            height: size,
            decoration: BoxDecoration(color: color, shape: BoxShape.circle),
          ),
        ],
      ),
    );
  }
}
