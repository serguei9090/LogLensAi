import "package:flutter/material.dart";

import "../../theme/app_theme.dart";

/// Generic themed chart container/wrapper.
///
/// Port of `src/components/atoms/ReactECharts.tsx`. The React source wraps
/// Apache ECharts (a JS charting library reached via a raw DOM `<div>` +
/// `useEffect` lifecycle: `echarts.init`, a `ResizeObserver`-driven
/// `resize()`, `showLoading()`/`hideLoading()`, and dynamic event
/// binding/unbinding). Flutter has no equivalent JS-interop chart engine to
/// wrap at the atom tier -- concrete chart widgets (line/bar/area, backed by
/// a real Flutter charting package) are organism-tier work for a later
/// pass, not this one.
///
/// [AppChartContainer] is the structural placeholder those organisms will
/// render inside of: a themed padding/border/background wrapper (replacing
/// the bare `<div>`) that takes an arbitrary [child] instead of an ECharts
/// `option`, and reproduces the one piece of the React source's behavior
/// that *is* atom-appropriate -- the `loading` overlay affordance
/// (`chart.showLoading({...})`), using the same "Synchronizing..." label
/// and the app's `primary`/`textPrimary`/`bgBase` tokens in place of the
/// React version's hardcoded `#22c55e`/`#e8f5ec`/`rgba(13,15,14,0.8)`.
class AppChartContainer extends StatelessWidget {
  const AppChartContainer({
    super.key,
    required this.child,
    this.loading = false,
    this.padding = const EdgeInsets.all(AppSpacing.md),
    this.height,
  });

  /// Chart content -- a concrete chart widget once one exists, or a
  /// placeholder in the meantime.
  final Widget child;

  /// Mirrors the React version's `loading` prop: dims the container and
  /// overlays a spinner + "Synchronizing..." label.
  final bool loading;

  /// Inner padding around [child]. React's version is edge-to-edge
  /// (`width/height: 100%`, no padding of its own) and lets the parent
  /// control spacing; this defaults to [AppSpacing.md] since Flutter
  /// containers commonly own their own padding -- pass [EdgeInsets.zero]
  /// to match the React default exactly.
  final EdgeInsetsGeometry padding;

  /// Optional fixed height. Left `null` by default, in which case
  /// [_defaultMinHeight] applies as a floor -- a zero/near-zero-height
  /// chart container isn't a real layout callers want, and without a floor
  /// the [loading] overlay (spinner + label) can overflow a container
  /// that's sized only to a tiny placeholder [child].
  final double? height;

  static const double _defaultMinHeight = 160;

  @override
  Widget build(BuildContext context) {
    return Container(
      width: double.infinity,
      constraints: BoxConstraints(
        minHeight: height ?? _defaultMinHeight,
        maxHeight: height ?? double.infinity,
      ),
      padding: padding,
      decoration: BoxDecoration(
        color: AppColors.bgSurface.withValues(alpha: 0.4),
        border: Border.all(color: AppColors.border.withValues(alpha: 0.6)),
        borderRadius: BorderRadius.circular(AppRadius.lg),
      ),
      clipBehavior: Clip.antiAlias,
      child: Stack(
        alignment: Alignment.center,
        children: [
          child,
          if (loading) const _LoadingOverlay(),
        ],
      ),
    );
  }
}

class _LoadingOverlay extends StatelessWidget {
  const _LoadingOverlay();

  @override
  Widget build(BuildContext context) {
    return Positioned.fill(
      child: Container(
        color: AppColors.bgBase.withValues(alpha: 0.8),
        alignment: Alignment.center,
        child: Column(
          mainAxisSize: MainAxisSize.min,
          children: [
            const SizedBox(
              width: 20,
              height: 20,
              child: CircularProgressIndicator(strokeWidth: 2, color: AppColors.primary),
            ),
            const SizedBox(height: AppSpacing.sm),
            Text(
              "Synchronizing...",
              style: AppTypography.body.copyWith(fontSize: 11, color: AppColors.textPrimary),
            ),
          ],
        ),
      ),
    );
  }
}
