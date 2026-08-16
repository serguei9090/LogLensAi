/// Dart port of `src/components/molecules/ClusterRow.tsx`.
///
/// Dashboard row showing a single Drain3 cluster's template + hit count as
/// a proportion bar. Tapping expands the row and lazily loads up to 10
/// example raw log lines for that cluster via [fetchSamples] -- kept as an
/// injected callback (rather than calling `callSidecar`/a Riverpod ref
/// directly) so this widget stays presentation-only and testable in
/// isolation, matching the convention set by `LevelBar`/`IngestionOverlay`.
library;

import "package:flutter/material.dart";

import "../../models/cluster.dart";
import "../../theme/app_theme.dart";

/// Mirrors the TS `type: "error" | "noise"` union, which drives the bar/
/// text accent color.
enum ClusterRowType { error, noise }

class ClusterRow extends StatefulWidget {
  const ClusterRow({
    super.key,
    required this.index,
    required this.cluster,
    required this.total,
    required this.type,
    this.fetchSamples,
  });

  /// Zero-based position in the list; rendered as `#index+1`.
  final int index;
  final Cluster cluster;

  /// Denominator for the proportion bar (`cluster.size / total`).
  final int total;
  final ClusterRowType type;

  /// Loads up to ~10 example raw log lines for [cluster] on first expand.
  /// `null` disables the expand affordance entirely (mirrors the React
  /// guard `if (!clusterId || !workspaceId) return;`).
  final Future<List<String>> Function()? fetchSamples;

  @override
  State<ClusterRow> createState() => _ClusterRowState();
}

class _ClusterRowState extends State<ClusterRow> {
  bool _expanded = false;
  bool _loading = false;
  List<String> _samples = const [];

  Future<void> _toggleExpand() async {
    if (widget.fetchSamples == null) return;
    final next = !_expanded;
    setState(() => _expanded = next);

    if (next && _samples.isEmpty) {
      setState(() => _loading = true);
      try {
        final texts = await widget.fetchSamples!();
        if (!mounted) return;
        setState(() => _samples = texts);
      } catch (_) {
        // Mirrors the React version's console.error-and-swallow: the
        // "No sample logs found" empty state covers this case too.
      } finally {
        if (mounted) setState(() => _loading = false);
      }
    }
  }

  @override
  Widget build(BuildContext context) {
    final isError = widget.type == ClusterRowType.error;
    final barColor = isError ? AppColors.error : AppColors.debug;
    final pct = widget.total > 0 ? (widget.cluster.size / widget.total).clamp(0.0, 1.0) : 0.0;

    return Container(
      decoration: BoxDecoration(
        color: AppColors.bgSurface.withValues(alpha: 0.3),
        border: Border.all(color: Colors.transparent),
        borderRadius: BorderRadius.circular(AppRadius.lg),
      ),
      padding: const EdgeInsets.all(AppSpacing.sm),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          InkWell(
            onTap: widget.fetchSamples == null ? null : _toggleExpand,
            borderRadius: BorderRadius.circular(AppRadius.md),
            child: Row(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                SizedBox(
                  width: 24,
                  child: Text(
                    "#${widget.index + 1}",
                    style: AppTypography.log.copyWith(fontSize: 10, color: AppColors.textMuted),
                  ),
                ),
                const SizedBox(width: AppSpacing.sm),
                Expanded(
                  child: Column(
                    crossAxisAlignment: CrossAxisAlignment.start,
                    children: [
                      Text(
                        widget.cluster.template,
                        maxLines: 1,
                        overflow: TextOverflow.ellipsis,
                        style: AppTypography.log.copyWith(
                          fontSize: 11,
                          color: isError ? AppColors.error : AppColors.textPrimary,
                        ),
                      ),
                      const SizedBox(height: 6),
                      Row(
                        children: [
                          Expanded(
                            child: ClipRRect(
                              borderRadius: BorderRadius.circular(999),
                              child: Container(
                                height: 4,
                                color: AppColors.bgBase.withValues(alpha: 0.5),
                                child: FractionallySizedBox(
                                  alignment: Alignment.centerLeft,
                                  widthFactor: pct,
                                  child: DecoratedBox(
                                    decoration: BoxDecoration(
                                      color: barColor,
                                      boxShadow: [
                                        BoxShadow(color: barColor.withValues(alpha: 0.3), blurRadius: 8),
                                      ],
                                    ),
                                  ),
                                ),
                              ),
                            ),
                          ),
                          const SizedBox(width: AppSpacing.sm),
                          SizedBox(
                            width: 64,
                            child: Text(
                              "${_thousands(widget.cluster.size)} hits",
                              textAlign: TextAlign.right,
                              style: AppTypography.log.copyWith(fontSize: 10, color: AppColors.textMuted),
                            ),
                          ),
                        ],
                      ),
                    ],
                  ),
                ),
              ],
            ),
          ),
          if (_expanded) ...[
            const SizedBox(height: AppSpacing.sm),
            Padding(
              padding: const EdgeInsets.only(left: 40, right: AppSpacing.xs),
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  Row(
                    children: [
                      Text(
                        "EXAMPLE LOGS (UP TO 10)",
                        style: AppTypography.labelCaps.copyWith(fontSize: 9),
                      ),
                      if (_loading) ...[
                        const SizedBox(width: AppSpacing.xs),
                        const SizedBox(
                          width: 10,
                          height: 10,
                          child: CircularProgressIndicator(strokeWidth: 1.5, color: AppColors.primary),
                        ),
                      ],
                    ],
                  ),
                  const SizedBox(height: AppSpacing.xs),
                  if (_loading && _samples.isEmpty)
                    Text(
                      "Retrieving sample logs...",
                      style: AppTypography.log.copyWith(fontSize: 10, color: AppColors.textMuted),
                    )
                  else if (!_loading && _samples.isEmpty)
                    Text(
                      "No sample logs found.",
                      style: AppTypography.log.copyWith(fontSize: 10, color: AppColors.textMuted),
                    )
                  else
                    ..._samples.map(
                      (text) => Container(
                        margin: const EdgeInsets.only(bottom: AppSpacing.xs),
                        padding: const EdgeInsets.all(AppSpacing.xs),
                        decoration: BoxDecoration(
                          color: AppColors.bgBase.withValues(alpha: 0.6),
                          border: Border.all(color: AppColors.border.withValues(alpha: 0.3)),
                          borderRadius: BorderRadius.circular(AppRadius.sm),
                        ),
                        child: Text(
                          text,
                          style: AppTypography.log.copyWith(fontSize: 10, color: AppColors.textSecondary),
                        ),
                      ),
                    ),
                ],
              ),
            ),
          ],
        ],
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
