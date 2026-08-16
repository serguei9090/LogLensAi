/// Dart port of `src/components/molecules/IngestionOverlay.tsx`.
///
/// Full-bleed glassmorphism overlay shown over the log table while an
/// ingestion job is running: a spinner, a linear progress bar, and job
/// metadata (processed/total lines, job id, workspace id).
///
/// KNOWN QUIRK (documented in docs/migration/STATUS.md, "Progress log"):
/// manual-paste ingestion never creates an `ingestion_jobs` row on either
/// backend, so the job-completion polling this overlay depends on never
/// fires for that path and the overlay/loading state can appear stuck on
/// "Ingesting Logs" indefinitely for manual-paste sources. This is a
/// pre-existing backend bug (not a rendering bug) and is intentionally
/// NOT worked around here -- this widget just renders whatever [job] state
/// it's given, faithfully mirroring the React component.
library;

import "dart:ui";

import "package:flutter/material.dart";

import "../../models/ingestion_job.dart";
import "../../theme/app_colors.dart";
import "../../theme/app_typography.dart";

class IngestionOverlay extends StatelessWidget {
  const IngestionOverlay({super.key, this.job});

  final IngestionJob? job;

  @override
  Widget build(BuildContext context) {
    final processed = job?.processedLines ?? 0;
    final total = job?.totalLines ?? 1;
    final progress = total > 0 ? ((processed / total) * 100).clamp(0, 100).round() : 0;

    return Positioned.fill(
      child: ClipRRect(
        child: BackdropFilter(
          filter: ImageFilter.blur(sigmaX: 24, sigmaY: 24),
          child: Container(
            color: AppColors.bgBase.withValues(alpha: 0.8),
            alignment: Alignment.center,
            child: Column(
              mainAxisSize: MainAxisSize.min,
              children: [
                _Spinner(),
                const SizedBox(height: 48),
                ConstrainedBox(
                  constraints: const BoxConstraints(maxWidth: 448),
                  child: Padding(
                    padding: const EdgeInsets.symmetric(horizontal: 32),
                    child: Column(
                      children: [
                        Text(
                          "INGESTING LOGS",
                          textAlign: TextAlign.center,
                          style: AppTypography.h1.copyWith(
                            fontWeight: FontWeight.w900,
                            letterSpacing: -0.5,
                          ),
                        ),
                        const SizedBox(height: 4),
                        Text(
                          job != null
                              ? "${_thousands(processed)} / ${_thousands(total)} LINES PROCESSED"
                              : "INGESTING TO DATABASE...",
                          textAlign: TextAlign.center,
                          style: AppTypography.log.copyWith(
                            fontSize: 10,
                            letterSpacing: 1.5,
                            color: AppColors.textMuted.withValues(alpha: 0.6),
                          ),
                        ),
                        const SizedBox(height: 24),
                        ClipRRect(
                          borderRadius: BorderRadius.circular(999),
                          child: SizedBox(
                            height: 6,
                            child: LinearProgressIndicator(
                              value: job != null ? progress / 100 : null,
                              backgroundColor: Colors.white.withValues(alpha: 0.05),
                              valueColor: const AlwaysStoppedAnimation(AppColors.primary),
                            ),
                          ),
                        ),
                        const SizedBox(height: 8),
                        Row(
                          mainAxisAlignment: MainAxisAlignment.spaceBetween,
                          children: [
                            Text(
                              job != null ? "$progress% COMPLETE" : "LOADING...",
                              style: AppTypography.labelCaps.copyWith(
                                fontSize: 9,
                                color: AppColors.textMuted.withValues(alpha: 0.8),
                              ),
                            ),
                            Text(
                              "MINING PATTERNS",
                              style: AppTypography.labelCaps.copyWith(
                                fontSize: 9,
                                color: AppColors.textMuted.withValues(alpha: 0.8),
                              ),
                            ),
                          ],
                        ),
                      ],
                    ),
                  ),
                ),
                const SizedBox(height: 48),
                Row(
                  mainAxisSize: MainAxisSize.min,
                  children: [
                    Container(
                      padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 2),
                      decoration: BoxDecoration(
                        borderRadius: BorderRadius.circular(4),
                        border: Border.all(color: AppColors.border.withValues(alpha: 0.3)),
                        color: AppColors.bgSurface.withValues(alpha: 0.3),
                      ),
                      child: Text(
                        job != null ? "JOB_${job!.id}" : "JOB_PENDING",
                        style: AppTypography.log.copyWith(
                          fontSize: 10,
                          color: AppColors.textMuted.withValues(alpha: 0.3),
                        ),
                      ),
                    ),
                    const SizedBox(width: 16),
                    Text(
                      (job?.workspaceId.isNotEmpty ?? false) ? job!.workspaceId.toUpperCase() : "WS_SYSTEM",
                      style: AppTypography.log.copyWith(
                        fontSize: 10,
                        letterSpacing: 1,
                        color: AppColors.textMuted.withValues(alpha: 0.3),
                      ),
                    ),
                  ],
                ),
              ],
            ),
          ),
        ),
      ),
    );
  }

  static String _thousands(int count) {
    final s = count.toString();
    final buf = StringBuffer();
    for (var i = 0; i < s.length; i++) {
      if (i > 0 && (s.length - i) % 3 == 0) buf.write(",");
      buf.write(s[i]);
    }
    return buf.toString();
  }
}

class _Spinner extends StatefulWidget {
  @override
  State<_Spinner> createState() => _SpinnerState();
}

class _SpinnerState extends State<_Spinner> with SingleTickerProviderStateMixin {
  late final AnimationController _controller = AnimationController(
    vsync: this,
    duration: const Duration(seconds: 1),
  )..repeat();

  @override
  void dispose() {
    _controller.dispose();
    super.dispose();
  }

  @override
  Widget build(BuildContext context) {
    return SizedBox(
      width: 112,
      height: 112,
      child: DecoratedBox(
        decoration: BoxDecoration(
          shape: BoxShape.circle,
          color: AppColors.bgSurface.withValues(alpha: 0.8),
          border: Border.all(color: AppColors.primary.withValues(alpha: 0.2), width: 2),
          boxShadow: [
            BoxShadow(color: AppColors.primary.withValues(alpha: 0.3), blurRadius: 48),
          ],
        ),
        child: Center(
          child: RotationTransition(
            turns: _controller,
            child: const Icon(Icons.autorenew, size: 56, color: AppColors.primary),
          ),
        ),
      ),
    );
  }
}
