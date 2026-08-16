/// Shared animation helpers used by several atoms to mirror Tailwind's
/// `animate-ping` / `animate-pulse` utility classes, which the React source
/// leans on for "live"/"active" indicators (see [StatusDot], [TailSwitch],
/// [IngestionProgressBadge]). Not one of the 13 ported atoms itself — a
/// small internal support file to avoid duplicating `AnimationController`
/// boilerplate three times.
library;

import "package:flutter/material.dart";

/// Mirrors Tailwind's `animate-ping`: a solid dot that scales up from 1x to
/// 2x while fading from 75% to 0% opacity, looping forever. Meant to be
/// stacked behind a static dot of the same [color]/[size].
class PingDot extends StatefulWidget {
  const PingDot({
    super.key,
    required this.color,
    required this.size,
    this.duration = const Duration(milliseconds: 1000),
  });

  final Color color;
  final double size;
  final Duration duration;

  @override
  State<PingDot> createState() => _PingDotState();
}

class _PingDotState extends State<PingDot> with SingleTickerProviderStateMixin {
  late final AnimationController _controller = AnimationController(
    vsync: this,
    duration: widget.duration,
  )..repeat();

  @override
  void dispose() {
    _controller.dispose();
    super.dispose();
  }

  @override
  Widget build(BuildContext context) {
    return AnimatedBuilder(
      animation: _controller,
      builder: (context, _) {
        final t = Curves.easeOut.transform(_controller.value);
        return Opacity(
          opacity: (0.75 * (1 - t)).clamp(0.0, 1.0),
          child: Transform.scale(
            scale: 1 + t,
            child: Container(
              width: widget.size,
              height: widget.size,
              decoration: BoxDecoration(color: widget.color, shape: BoxShape.circle),
            ),
          ),
        );
      },
    );
  }
}

/// Mirrors Tailwind's `animate-pulse`: opacity oscillates between 50% and
/// 100% on an ease-in-out loop. Wraps an arbitrary [child].
class PulseOpacity extends StatefulWidget {
  const PulseOpacity({
    super.key,
    required this.child,
    this.duration = const Duration(milliseconds: 1000),
  });

  final Widget child;
  final Duration duration;

  @override
  State<PulseOpacity> createState() => _PulseOpacityState();
}

class _PulseOpacityState extends State<PulseOpacity> with SingleTickerProviderStateMixin {
  late final AnimationController _controller = AnimationController(
    vsync: this,
    duration: widget.duration,
  )..repeat(reverse: true);

  @override
  void dispose() {
    _controller.dispose();
    super.dispose();
  }

  @override
  Widget build(BuildContext context) {
    return AnimatedBuilder(
      animation: _controller,
      builder: (context, _) {
        final opacity = 0.5 + 0.5 * Curves.easeInOut.transform(_controller.value);
        return Opacity(opacity: opacity, child: widget.child);
      },
    );
  }
}
