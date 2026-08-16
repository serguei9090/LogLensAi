/// Dart port of `src/components/organisms/DiagnosticSidebar.tsx`.
///
/// Right-side AI-diagnostics drawer: root cause, summary, and recommended
/// actions for a selected cluster. Fixed 384px width.
///
/// Note: mirrors the React source's current wiring state -- `App.tsx`
/// always passes `diagnosticOpen={false}` there, i.e. this panel is built
/// but not yet reachable from the live UI. Ported faithfully regardless;
/// wiring it into the app shell (a trigger action + real diagnostic data
/// plumbing) is page-tier work for a later pass.
///
/// Deviation from the React source: the React version is positioned with
/// `fixed inset-y-0 right-0` (an always-mounted, self-positioning overlay
/// over the whole viewport) and slides via `translate-x-full`/`translate
/// -x-0`. This port keeps the slide animation ([AnimatedSlide]) but not the
/// self-positioning -- it renders as a plain fixed-width column meant to be
/// placed by the caller (e.g. inside a `Stack` + `Positioned.fill` at the
/// page-shell layer, once that lands), which keeps this organism testable
/// in a plain bounded box without requiring a `Stack`/`Navigator` ancestor.
library;

import "package:flutter/material.dart";

import "../../theme/app_theme.dart";

/// Mirrors the React source's exported `DiagnosticData` interface.
class DiagnosticData {
  const DiagnosticData({
    required this.summary,
    required this.rootCause,
    required this.recommendedActions,
  });

  final String summary;
  final String rootCause;
  final List<String> recommendedActions;
}

class DiagnosticSidebar extends StatelessWidget {
  const DiagnosticSidebar({
    super.key,
    required this.open,
    required this.onClose,
    required this.data,
    required this.loading,
  });

  final bool open;
  final VoidCallback onClose;
  final DiagnosticData? data;
  final bool loading;

  static const double width = 384;

  @override
  Widget build(BuildContext context) {
    return AnimatedSlide(
      duration: const Duration(milliseconds: 300),
      curve: Curves.easeInOut,
      offset: open ? Offset.zero : const Offset(1, 0),
      child: Container(
        width: width,
        decoration: const BoxDecoration(
          color: AppColors.bgSurfaceBright,
          border: Border(left: BorderSide(color: AppColors.border)),
        ),
        child: Column(
          children: [
            _header(),
            Expanded(child: _body()),
          ],
        ),
      ),
    );
  }

  Widget _header() {
    return Container(
      padding: const EdgeInsets.all(AppSpacing.md),
      decoration: const BoxDecoration(
        color: AppColors.bgSurface,
        border: Border(bottom: BorderSide(color: AppColors.border)),
      ),
      child: Row(
        mainAxisAlignment: MainAxisAlignment.spaceBetween,
        children: [
          Row(
            children: [
              const Icon(Icons.bolt, size: 20, color: AppColors.primary),
              const SizedBox(width: AppSpacing.sm),
              Text(
                "AI Diagnostics",
                style: AppTypography.h2.copyWith(color: AppColors.primary),
              ),
            ],
          ),
          IconButton(
            icon: const Icon(Icons.close, size: 16),
            color: AppColors.textMuted,
            onPressed: onClose,
          ),
        ],
      ),
    );
  }

  Widget _body() {
    if (loading) {
      return Padding(
        padding: const EdgeInsets.all(AppSpacing.lg),
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            _skeletonBar(0.75),
            const SizedBox(height: AppSpacing.sm),
            _skeletonBar(0.5),
            const SizedBox(height: AppSpacing.sm),
            _skeletonBar(0.85),
          ],
        ),
      );
    }

    final d = data;
    if (d == null) {
      return const Center(
        child: Padding(
          padding: EdgeInsets.only(bottom: 80),
          child: Column(
            mainAxisAlignment: MainAxisAlignment.center,
            children: [
              Icon(Icons.bolt, size: 48, color: AppColors.textMuted),
              SizedBox(height: AppSpacing.md),
              Text(
                "Select a cluster to analyze",
                style: TextStyle(color: AppColors.textMuted),
              ),
            ],
          ),
        ),
      );
    }

    return SingleChildScrollView(
      padding: const EdgeInsets.all(AppSpacing.lg),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          _sectionLabel(Icons.warning_amber_rounded, "Root Cause", AppColors.warning),
          const SizedBox(height: AppSpacing.sm),
          Container(
            width: double.infinity,
            padding: const EdgeInsets.all(AppSpacing.sm),
            decoration: BoxDecoration(
              color: AppColors.warningBg.withValues(alpha: 0.2),
              borderRadius: BorderRadius.circular(AppRadius.sm),
              border: Border.all(color: AppColors.warning.withValues(alpha: 0.2)),
            ),
            child: Text(
              d.rootCause,
              style: AppTypography.body.copyWith(height: 1.5),
            ),
          ),
          const SizedBox(height: AppSpacing.lg),
          const Divider(color: AppColors.borderMuted),
          const SizedBox(height: AppSpacing.lg),
          Text(
            "SUMMARY",
            style: AppTypography.labelCaps.copyWith(fontSize: 12, letterSpacing: 0.5),
          ),
          const SizedBox(height: AppSpacing.sm),
          Text(d.summary, style: AppTypography.body.copyWith(height: 1.5)),
          const SizedBox(height: AppSpacing.lg),
          const Divider(color: AppColors.borderMuted),
          const SizedBox(height: AppSpacing.lg),
          _sectionLabel(Icons.lightbulb_outline, "Recommended Actions", AppColors.info),
          const SizedBox(height: AppSpacing.sm + 4),
          for (var i = 0; i < d.recommendedActions.length; i++)
            Padding(
              padding: const EdgeInsets.only(bottom: AppSpacing.sm),
              child: Container(
                width: double.infinity,
                padding: const EdgeInsets.all(AppSpacing.sm),
                decoration: BoxDecoration(
                  color: AppColors.bgBase,
                  borderRadius: BorderRadius.circular(AppRadius.sm),
                  border: Border.all(color: AppColors.border),
                ),
                child: Row(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    Text(
                      "${i + 1}.",
                      style: AppTypography.monoBody.copyWith(
                        color: AppColors.primary,
                        fontWeight: FontWeight.bold,
                      ),
                    ),
                    const SizedBox(width: AppSpacing.sm),
                    Expanded(
                      child: Text(
                        d.recommendedActions[i],
                        style: AppTypography.body.copyWith(height: 1.2),
                      ),
                    ),
                  ],
                ),
              ),
            ),
        ],
      ),
    );
  }

  Widget _sectionLabel(IconData icon, String text, Color iconColor) {
    return Row(
      children: [
        Icon(icon, size: 16, color: iconColor),
        const SizedBox(width: AppSpacing.xs),
        Text(
          text.toUpperCase(),
          style: AppTypography.labelCaps.copyWith(fontSize: 12, letterSpacing: 0.5),
        ),
      ],
    );
  }

  Widget _skeletonBar(double widthFraction) {
    return FractionallySizedBox(
      widthFactor: widthFraction,
      alignment: Alignment.centerLeft,
      child: Container(
        height: 16,
        decoration: BoxDecoration(
          color: AppColors.border,
          borderRadius: BorderRadius.circular(AppRadius.sm),
        ),
      ),
    );
  }
}
