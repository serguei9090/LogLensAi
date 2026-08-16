/// Dart port of `src/components/molecules/ProcessingNotification.tsx`.
///
/// Floating "Drain3 Pattern Mining" toast shown while ingestion jobs are
/// actively clustering. Purely presentational: like [IngestionOverlay] it
/// takes the job list as a direct constructor param instead of subscribing
/// to a provider itself, so it stays trivially testable and the choice of
/// *where* jobs come from (a Riverpod provider, in this app) stays with the
/// caller. Renders nothing ([SizedBox.shrink]) when there are no active
/// jobs, mirroring the React component returning `null`.
///
/// Positioning deviation: the React version is `fixed bottom-6 right-6
/// z-[9999]` (viewport-relative, no ancestor needed). Flutter has no
/// z-index-free "fixed" primitive; the natural equivalent is a
/// `Positioned` inside an app-level `Stack`, but that would force every
/// caller (including widget tests) to provide one. Instead this widget
/// self-aligns via [Align] (bottom-right, with outer padding matching the
/// React `bottom-6 right-6` = 24px), which works when composed into any
/// bounded box (a `Stack` child, or directly in a `Scaffold` body) without
/// requiring a `Stack` ancestor specifically.
library;

import "package:flutter/material.dart";

import "../../models/ingestion_job.dart";
import "../../theme/app_colors.dart";
import "../../theme/app_spacing.dart";
import "../../theme/app_typography.dart";

class ProcessingNotification extends StatefulWidget {
  const ProcessingNotification({super.key, required this.jobs});

  /// All known ingestion jobs (e.g. `ingestionProvider`'s job list). Only
  /// `processing`/`pending` jobs count toward the aggregate shown here.
  final List<IngestionJob> jobs;

  @override
  State<ProcessingNotification> createState() => _ProcessingNotificationState();
}

class _ProcessingNotificationState extends State<ProcessingNotification>
    with SingleTickerProviderStateMixin {
  // Created eagerly in initState (not as a `late final` field initializer)
  // deliberately: build() early-returns (SizedBox.shrink) whenever there are
  // no active jobs and never references this controller in that path. A
  // lazy `late final` would then only construct itself the first time
  // dispose() reads it -- i.e. after the element is already deactivated --
  // which throws ("Looking up a deactivated widget's ancestor is unsafe")
  // because AnimationController's ticker needs a live BuildContext to find
  // its TickerMode ancestor.
  late final AnimationController _spinController;

  @override
  void initState() {
    super.initState();
    _spinController = AnimationController(vsync: this, duration: const Duration(seconds: 1))
      ..repeat();
  }

  @override
  void dispose() {
    _spinController.dispose();
    super.dispose();
  }

  @override
  Widget build(BuildContext context) {
    // React filters strictly to "processing" | "pending" -- match exactly
    // rather than reusing the broader `IngestionJob.isActive` (which also
    // covers "queued"/"failed").
    final jobs = widget.jobs.where((j) => j.status == "processing" || j.status == "pending").toList();

    if (jobs.isEmpty) {
      return const SizedBox.shrink();
    }

    final totalProcessed = jobs.fold<int>(0, (sum, j) => sum + j.processedLines);
    final totalLines = jobs.fold<int>(0, (sum, j) => sum + j.totalLines);
    final percent = totalLines > 0 ? ((totalProcessed / totalLines) * 100).round() : 0;

    return Align(
      alignment: Alignment.bottomRight,
      child: Padding(
        padding: const EdgeInsets.all(24),
        child: ConstrainedBox(
          constraints: const BoxConstraints(minWidth: 240),
          child: Stack(
            clipBehavior: Clip.none,
            children: [
              Container(
                padding: const EdgeInsets.all(AppSpacing.md),
                decoration: BoxDecoration(
                  color: AppColors.bgSurface.withValues(alpha: 0.8),
                  borderRadius: BorderRadius.circular(16),
                  border: Border.all(color: AppColors.primary.withValues(alpha: 0.3)),
                  boxShadow: [
                    BoxShadow(color: AppColors.primary.withValues(alpha: 0.1), blurRadius: 32),
                  ],
                ),
                child: Column(
                  mainAxisSize: MainAxisSize.min,
                  crossAxisAlignment: CrossAxisAlignment.stretch,
                  children: [
                    Row(
                      children: [
                        SizedBox(
                          width: 16,
                          height: 16,
                          child: Stack(
                            clipBehavior: Clip.none,
                            children: [
                              RotationTransition(
                                turns: _spinController,
                                child: const Icon(
                                  Icons.refresh,
                                  size: 16,
                                  color: AppColors.primary,
                                ),
                              ),
                              const Positioned(
                                top: -2,
                                right: -2,
                                child: Icon(
                                  Icons.auto_awesome,
                                  size: 8,
                                  color: AppColors.primary,
                                ),
                              ),
                            ],
                          ),
                        ),
                        const SizedBox(width: AppSpacing.sm),
                        Expanded(
                          child: Column(
                            crossAxisAlignment: CrossAxisAlignment.start,
                            children: [
                              Text(
                                "DRAIN3 PATTERN MINING",
                                style: AppTypography.labelCaps.copyWith(color: AppColors.textPrimary),
                              ),
                              const SizedBox(height: 2),
                              Text(
                                "${jobs.length} active Drain3 ${jobs.length == 1 ? 'task' : 'tasks'}",
                                style: AppTypography.log.copyWith(
                                  fontSize: 9,
                                  color: AppColors.textMuted,
                                ),
                              ),
                            ],
                          ),
                        ),
                        Text(
                          "$percent%",
                          style: AppTypography.log.copyWith(
                            fontSize: 12,
                            fontWeight: FontWeight.w700,
                            color: AppColors.primary,
                          ),
                        ),
                      ],
                    ),
                    const SizedBox(height: AppSpacing.sm),
                    ClipRRect(
                      borderRadius: BorderRadius.circular(999),
                      child: SizedBox(
                        height: 4,
                        child: TweenAnimationBuilder<double>(
                          tween: Tween(begin: 0, end: percent.toDouble()),
                          duration: const Duration(milliseconds: 400),
                          curve: Curves.easeOut,
                          builder: (context, value, child) {
                            return LinearProgressIndicator(
                              value: value / 100,
                              backgroundColor: AppColors.bgBase.withValues(alpha: 0.5),
                              valueColor: const AlwaysStoppedAnimation(AppColors.primary),
                            );
                          },
                        ),
                      ),
                    ),
                    const SizedBox(height: 8),
                    Row(
                      mainAxisAlignment: MainAxisAlignment.spaceBetween,
                      children: [
                        Text(
                          "${_thousands(totalProcessed)} / ${_thousands(totalLines)}",
                          style: AppTypography.log.copyWith(
                            fontSize: 8,
                            color: AppColors.textMuted,
                          ),
                        ),
                        Text(
                          "MINING PATTERNS",
                          style: AppTypography.labelCaps.copyWith(
                            fontSize: 8,
                            color: AppColors.primary,
                          ),
                        ),
                      ],
                    ),
                  ],
                ),
              ),
              // Decorative left accent strip, mirroring the React
              // `absolute top-0 left-0 w-1 h-full bg-primary-green/40`.
              Positioned(
                top: 0,
                left: 0,
                bottom: 0,
                child: ClipRRect(
                  borderRadius: const BorderRadius.horizontal(left: Radius.circular(16)),
                  child: Container(width: 4, color: AppColors.primary.withValues(alpha: 0.4)),
                ),
              ),
            ],
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
