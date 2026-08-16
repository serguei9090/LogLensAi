import "package:flutter/material.dart";

import "../../theme/app_theme.dart";

/// Animated "..." dots indicating the AI is streaming a response.
///
/// Port of `src/components/atoms/TypingIndicator.tsx`'s three staggered
/// `animate-bounce` dots. Driven by a single [AnimationController] with
/// three offset [Interval]s rather than three independent CSS animations.
class TypingIndicator extends StatefulWidget {
  const TypingIndicator({super.key});

  @override
  State<TypingIndicator> createState() => _TypingIndicatorState();
}

class _TypingIndicatorState extends State<TypingIndicator>
    with SingleTickerProviderStateMixin {
  late final AnimationController _controller = AnimationController(
    vsync: this,
    duration: const Duration(milliseconds: 1000),
  )..repeat();

  static const List<double> _delays = [0.0, 0.15, 0.3];
  static const List<double> _opacities = [1.0, 0.7, 0.4];

  @override
  void dispose() {
    _controller.dispose();
    super.dispose();
  }

  @override
  Widget build(BuildContext context) {
    return Padding(
      padding: const EdgeInsets.symmetric(horizontal: AppSpacing.xs, vertical: AppSpacing.sm),
      child: Row(
        mainAxisSize: MainAxisSize.min,
        children: List.generate(3, (i) {
          final animation = CurvedAnimation(
            parent: _controller,
            curve: Interval(_delays[i], (_delays[i] + 0.6).clamp(0.0, 1.0), curve: Curves.easeInOut),
          );
          return Padding(
            padding: EdgeInsets.only(right: i < 2 ? 6 : 0),
            child: AnimatedBuilder(
              animation: animation,
              builder: (context, child) {
                // Bounce: 0 -> up -> 0, matching Tailwind's keyframe shape.
                final bounce = (animation.value < 0.5)
                    ? animation.value * 2
                    : (1 - animation.value) * 2;
                return Transform.translate(
                  offset: Offset(0, -4 * bounce),
                  child: child,
                );
              },
              child: Container(
                width: 6,
                height: 6,
                decoration: BoxDecoration(
                  color: AppColors.accentViolet.withValues(alpha: _opacities[i]),
                  shape: BoxShape.circle,
                ),
              ),
            ),
          );
        }),
      ),
    );
  }
}
