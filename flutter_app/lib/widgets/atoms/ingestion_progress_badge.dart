import "package:flutter/material.dart";

import "../../theme/app_theme.dart";
import "src/pulse_animations.dart";

/// Status of a single ingestion source. Mirrors the TS `IngestionStatus`
/// union from `src/components/atoms/IngestionProgressBadge.tsx`.
enum IngestionStatus { queued, pending, processing, completed, failed }

/// Compact source-level ingestion status indicator, shown inside a
/// `SourceItem` row in the sidebar hierarchy tree.
///
///  - `queued`     -> amber ring + `#N` queue position
///  - `pending`    -> primary progress pill (0%), pulsing
///  - `processing` -> primary progress pill with a determinate mini-bar
///  - `completed`  -> renders nothing ([SizedBox.shrink])
///  - `failed`     -> red "ERR" pill
class IngestionProgressBadge extends StatelessWidget {
  const IngestionProgressBadge({
    super.key,
    required this.status,
    this.progress = 0,
    this.queuePosition = 0,
  });

  final IngestionStatus status;

  /// Progress ratio 0-1 (`processed_lines / total_lines`).
  final double progress;

  /// 1-based queue position, shown when [status] is `queued`.
  final int queuePosition;

  @override
  Widget build(BuildContext context) {
    if (status == IngestionStatus.completed) {
      return const SizedBox.shrink();
    }

    if (status == IngestionStatus.queued) {
      return Tooltip(
        message: "Queued — position #$queuePosition",
        child: _Pill(
          bg: AppColors.warning.withValues(alpha: 0.15),
          fg: AppColors.warning,
          border: AppColors.warning.withValues(alpha: 0.3),
          children: [
            PulseOpacity(
              child: _dot(AppColors.warning),
            ),
            const SizedBox(width: 2),
            Text(
              queuePosition > 0 ? "#$queuePosition" : "Q",
              style: _pillTextStyle(AppColors.warning),
            ),
          ],
        ),
      );
    }

    if (status == IngestionStatus.failed) {
      return const Tooltip(
        message: "Ingestion failed",
        child: _Pill(
          bg: Color(0x26EF4444), // error @ 15%
          fg: AppColors.error,
          border: Color(0x4DEF4444), // error @ 30%
          children: [
            _StaticDot(color: AppColors.error),
            SizedBox(width: 2),
            Text("ERR", style: TextStyle(
              color: AppColors.error,
              fontSize: 9,
              fontWeight: FontWeight.w700,
              height: 1,
            )),
          ],
        ),
      );
    }

    // processing or pending.
    final pct = (progress.clamp(0.0, 1.0) * 100).round();
    return Tooltip(
      message: "Processing — $pct%",
      child: _Pill(
        bg: AppColors.primary.withValues(alpha: 0.15),
        fg: AppColors.primary,
        border: AppColors.primary.withValues(alpha: 0.3),
        children: [
          Container(
            width: 32,
            height: 6,
            decoration: BoxDecoration(
              color: AppColors.primary.withValues(alpha: 0.2),
              borderRadius: BorderRadius.circular(3),
            ),
            child: Align(
              alignment: Alignment.centerLeft,
              child: FractionallySizedBox(
                widthFactor: pct / 100,
                child: Container(
                  decoration: BoxDecoration(
                    color: AppColors.primary,
                    borderRadius: BorderRadius.circular(3),
                  ),
                ),
              ),
            ),
          ),
          const SizedBox(width: 4),
          PulseOpacity(child: Text("$pct%", style: _pillTextStyle(AppColors.primary))),
        ],
      ),
    );
  }

  static Widget _dot(Color color) => _StaticDot(color: color);

  static TextStyle _pillTextStyle(Color color) =>
      TextStyle(color: color, fontSize: 9, fontWeight: FontWeight.w700, height: 1);
}

class _StaticDot extends StatelessWidget {
  const _StaticDot({required this.color});
  final Color color;

  @override
  Widget build(BuildContext context) {
    return Container(
      width: 4,
      height: 4,
      decoration: BoxDecoration(color: color, shape: BoxShape.circle),
    );
  }
}

class _Pill extends StatelessWidget {
  const _Pill({
    required this.bg,
    required this.fg,
    required this.border,
    required this.children,
  });

  final Color bg;
  final Color fg;
  final Color border;
  final List<Widget> children;

  @override
  Widget build(BuildContext context) {
    return Container(
      padding: const EdgeInsets.symmetric(horizontal: 6, vertical: 2),
      decoration: BoxDecoration(
        color: bg,
        borderRadius: BorderRadius.circular(AppRadius.xl),
        border: Border.all(color: border),
      ),
      child: Row(mainAxisSize: MainAxisSize.min, children: children),
    );
  }
}
