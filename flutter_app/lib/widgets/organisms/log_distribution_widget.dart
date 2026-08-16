/// Dart port of `src/components/organisms/LogDistributionWidget.tsx`.
///
/// Fixed-height (220px) histogram strip: a header ("Distribution Insights",
/// a conditional "Reset Zoom" chip, "Spike Detected"/"Live Flow" badges, an
/// optional close button) above a stacked bar chart of log volume per time
/// bucket, level-colored via [AppColors.forLogLevel]. Fetches via
/// [distributionServiceProvider] (`get_log_distribution` + `get_anomalies`),
/// polls every 3s while [isTailing], and re-fetches whenever the widget's
/// filter-ish props change or `investigationProvider`'s `timeRange` changes
/// -- mirroring the React source's `useEffect` dependency array (which
/// includes `timeRange` from the store) with `didUpdateWidget` for prop
/// changes and `ref.listen` for the store-driven one.
///
/// Deviation: the React version renders a full `ReactECharts` stacked bar
/// chart (hover tooltips, click-to-zoom, custom axis label formatting with
/// date-boundary markers). The real `fl_chart`-based equivalent
/// (`DashboardCharts`, with drag-to-zoom) is being built separately by
/// another agent in this migration pass -- this organism intentionally
/// stays basic per the task brief: a `Row` of level-stacked `Container`
/// bars (proportionally accurate heights, [AppColors.forLogLevel] colors),
/// a [Tooltip] standing in for ECharts' rich hover tooltip, and tap-to-zoom
/// (mirrors `handleChartClick`: sets `investigationProvider`'s `timeRange`
/// to the tapped bucket's `[start, start+bucketDuration)` window). Anomalous
/// buckets get a bordered outline around the whole bar rather than ECharts'
/// border-only-on-the-error-segment styling -- close enough to read as "this
/// bar is flagged" without reimplementing per-segment corner radii.
library;

import "dart:async";

import "package:flutter/material.dart";
import "package:flutter_riverpod/flutter_riverpod.dart";

import "../../models/distribution.dart";
import "../../providers/distribution_provider.dart";
import "../../providers/investigation_provider.dart";
import "../../theme/app_theme.dart";

/// Level names ordered highest-severity-first; used to stack each bucket's
/// segments with the most severe level on top. Anything not in this list
/// (an unrecognized level string) sorts after all known levels.
const List<String> _kLevelPriority = ["ERROR", "WARN", "WARNING", "INFO", "DEBUG", "TRACE"];

List<MapEntry<String, int>> _orderedLevels(Map<String, int> counts) {
  final entries = counts.entries.where((e) => e.value > 0).toList();
  entries.sort((a, b) {
    final ai = _kLevelPriority.indexOf(a.key.toUpperCase());
    final bi = _kLevelPriority.indexOf(b.key.toUpperCase());
    final an = ai == -1 ? _kLevelPriority.length : ai;
    final bn = bi == -1 ? _kLevelPriority.length : bi;
    if (an != bn) return an.compareTo(bn);
    return a.key.compareTo(b.key);
  });
  return entries;
}

/// Port of the React source's `parseDbDate`: parses a `"yyyy-MM-dd HH:mm:ss"`
/// (or `T`-separated) bucket label as a local [DateTime].
DateTime _parseDbDate(String str) {
  final normalized = str.replaceFirst("T", " ");
  final parts = normalized.split(" ");
  final dateSegs = parts[0].split("-");
  final year = int.tryParse(dateSegs.isNotEmpty ? dateSegs[0] : "") ?? 1970;
  final month = int.tryParse(dateSegs.length > 1 ? dateSegs[1] : "") ?? 1;
  final day = int.tryParse(dateSegs.length > 2 ? dateSegs[2] : "") ?? 1;
  final timeSegs = (parts.length > 1 ? parts[1] : "00:00:00").split(":");
  final hour = int.tryParse(timeSegs.isNotEmpty ? timeSegs[0] : "") ?? 0;
  final minute = int.tryParse(timeSegs.length > 1 ? timeSegs[1] : "") ?? 0;
  final second = int.tryParse(timeSegs.length > 2 ? timeSegs[2] : "") ?? 0;
  return DateTime(year, month, day, hour, minute, second);
}

/// Port of `formatToDbString`.
String _formatToDbString(DateTime date) {
  String pad(int n) => n.toString().padLeft(2, "0");
  return "${date.year}-${pad(date.month)}-${pad(date.day)}T${pad(date.hour)}:"
      "${pad(date.minute)}:${pad(date.second)}";
}

/// Port of `getBucketDurationMs`.
int _bucketDurationMs(String bucketInterval) {
  final parts = bucketInterval.split(" ");
  if (parts.isEmpty) return 3600 * 1000;
  final val = int.tryParse(parts[0]);
  final unit = parts.length > 1 ? parts[1].toLowerCase() : null;
  if (val == null || unit == null) return 3600 * 1000;
  if (unit.startsWith("second")) return val * 1000;
  if (unit.startsWith("minute")) return val * 60 * 1000;
  if (unit.startsWith("hour")) return val * 3600 * 1000;
  if (unit.startsWith("day")) return val * 24 * 3600 * 1000;
  if (unit.startsWith("month")) return val * 30 * 24 * 3600 * 1000;
  return 3600 * 1000;
}

bool _isFiltered(TimeRange range, TimeRange bounds) {
  if (bounds.start.isEmpty || bounds.end.isEmpty) return false;
  return (range.start.isNotEmpty && range.start != bounds.start) ||
      (range.end.isNotEmpty && range.end != bounds.end);
}

class LogDistributionWidget extends ConsumerStatefulWidget {
  const LogDistributionWidget({
    super.key,
    required this.workspaceId,
    this.sourceIds,
    this.fusionId,
    this.filters,
    this.query,
    this.isTailing = false,
    this.onClose,
  });

  final String workspaceId;
  final List<String>? sourceIds;
  final String? fusionId;
  final List<Map<String, dynamic>>? filters;
  final String? query;
  final bool isTailing;
  final VoidCallback? onClose;

  @override
  ConsumerState<LogDistributionWidget> createState() => _LogDistributionWidgetState();
}

class _LogDistributionWidgetState extends ConsumerState<LogDistributionWidget> {
  List<DistributionBucket> _buckets = const [];
  String _bucketInterval = "1 hour";
  List<LogAnomaly> _anomalies = const [];
  bool _loading = false;
  String? _error;
  Timer? _pollTimer;

  @override
  void initState() {
    super.initState();
    _fetch();
    _syncTimer();
  }

  @override
  void didUpdateWidget(covariant LogDistributionWidget oldWidget) {
    super.didUpdateWidget(oldWidget);
    if (oldWidget.workspaceId != widget.workspaceId ||
        oldWidget.sourceIds != widget.sourceIds ||
        oldWidget.fusionId != widget.fusionId ||
        oldWidget.filters != widget.filters ||
        oldWidget.query != widget.query) {
      _fetch();
    }
    if (oldWidget.isTailing != widget.isTailing) {
      _syncTimer();
    }
  }

  @override
  void dispose() {
    _pollTimer?.cancel();
    super.dispose();
  }

  void _syncTimer() {
    _pollTimer?.cancel();
    _pollTimer = widget.isTailing
        ? Timer.periodic(const Duration(seconds: 3), (_) => _fetch())
        : null;
  }

  Future<void> _fetch() async {
    if (widget.workspaceId.isEmpty) return;
    setState(() {
      _loading = true;
      _error = null;
    });
    try {
      final service = ref.read(distributionServiceProvider);
      final timeRange = ref.read(investigationProvider).timeRange;
      // Future.wait (not two sequential awaits) mirrors the React source's
      // Promise.all: both requests are always awaited together, so a
      // rejection from one never leaves the other's Future un-listened-to
      // (which would otherwise surface as an unhandled async error once the
      // first `await` throws and skips the second).
      final results = await Future.wait<Object>([
        service.fetchDistribution(
          workspaceId: widget.workspaceId,
          sourceIds: widget.sourceIds,
          fusionId: widget.fusionId,
          query: widget.query,
          filters: widget.filters,
          startTime: timeRange.start.isEmpty ? null : timeRange.start,
          endTime: timeRange.end.isEmpty ? null : timeRange.end,
        ),
        service.fetchAnomalies(widget.workspaceId),
      ]);
      final dist = results[0] as DistributionResult;
      final anomalies = results[1] as List<LogAnomaly>;
      if (!mounted) return;
      setState(() {
        _buckets = dist.buckets;
        _bucketInterval = dist.bucketInterval;
        _anomalies = anomalies;
        _loading = false;
      });
    } catch (_) {
      if (!mounted) return;
      setState(() {
        _loading = false;
        _error = "Failed to load log distribution";
      });
    }
  }

  void _handleBarTap(int index) {
    if (index < 0 || index >= _buckets.length) return;
    final bucket = _buckets[index].bucket;
    final start = _parseDbDate(bucket);
    final end = start.add(Duration(milliseconds: _bucketDurationMs(_bucketInterval)));
    final parts = bucket.split(" ");
    final displayTime = parts.length == 2 ? parts[1] : bucket;
    ref
        .read(investigationProvider.notifier)
        .setTimeRange(
          TimeRange(
            start: _formatToDbString(start),
            end: _formatToDbString(end),
            label: "$displayTime (Zoomed)",
          ),
        );
  }

  @override
  Widget build(BuildContext context) {
    final timeRange = ref.watch(investigationProvider.select((s) => s.timeRange));
    final timeRangeBounds = ref.watch(investigationProvider.select((s) => s.timeRangeBounds));
    ref.listen<TimeRange>(investigationProvider.select((s) => s.timeRange), (prev, next) {
      if (prev != next) _fetch();
    });

    final isFiltered = _isFiltered(timeRange, timeRangeBounds);
    final anomalyIndices = <int>{
      for (var i = 0; i < _buckets.length; i++)
        if (_anomalies.any((a) => a.timestamp.startsWith(_buckets[i].bucket))) i,
    };

    return Container(
      key: const Key("logDistributionWidget"),
      height: 220,
      width: double.infinity,
      decoration: const BoxDecoration(
        color: AppColors.bgBase,
        border: Border(bottom: BorderSide(color: AppColors.borderSubtle)),
      ),
      child: Column(
        children: [
          _Header(
            isFiltered: isFiltered,
            hasAnomalies: _anomalies.isNotEmpty,
            isTailing: widget.isTailing,
            onResetZoom: () =>
                ref.read(investigationProvider.notifier).resetTimeRangeToAllTime(),
            onClose: widget.onClose,
          ),
          Expanded(
            child: Padding(
              padding: const EdgeInsets.all(AppSpacing.md),
              // Every child here must be `Positioned` (not just the chart):
              // a `Stack` with a non-positioned child sizes itself to that
              // child instead of the incoming constraints, so a bare
              // `SizedBox.shrink()` overlay (the "nothing to show" case)
              // would collapse the whole chart area -- and every bar inside
              // it -- to zero size.
              child: Stack(
                children: [
                  if (_buckets.isNotEmpty)
                    Positioned.fill(
                      child: _HistogramChart(
                        buckets: _buckets,
                        anomalyIndices: anomalyIndices,
                        onBarTap: _handleBarTap,
                      ),
                    ),
                  Positioned.fill(child: _buildOverlay()),
                ],
              ),
            ),
          ),
        ],
      ),
    );
  }

  Widget _buildOverlay() {
    if (_loading && _buckets.isEmpty) {
      return ColoredBox(
        color: AppColors.bgBase.withValues(alpha: 0.8),
        child: const Center(
          child: Text(
            "Synchronizing timeline data...",
            style: TextStyle(fontSize: 11, color: AppColors.textMuted),
          ),
        ),
      );
    }
    if (_error != null) {
      return ColoredBox(
        color: AppColors.bgBase.withValues(alpha: 0.8),
        child: Center(
          child: Text(
            _error!,
            style: const TextStyle(
              fontSize: 11,
              color: AppColors.error,
              fontWeight: FontWeight.w600,
            ),
          ),
        ),
      );
    }
    if (_buckets.isEmpty) {
      return ColoredBox(
        color: AppColors.bgBase.withValues(alpha: 0.8),
        child: Center(
          child: Column(
            mainAxisSize: MainAxisSize.min,
            children: [
              Text(
                "No logs matching criteria in this range",
                style: TextStyle(fontSize: 11, color: AppColors.textMuted.withValues(alpha: 0.5)),
              ),
              if (widget.isTailing) ...[
                const SizedBox(height: 4),
                Text(
                  "Waiting for live data...",
                  style: TextStyle(fontSize: 10, color: AppColors.textMuted.withValues(alpha: 0.3)),
                ),
              ],
            ],
          ),
        ),
      );
    }
    return const SizedBox.shrink();
  }
}

class _Header extends StatelessWidget {
  const _Header({
    required this.isFiltered,
    required this.hasAnomalies,
    required this.isTailing,
    required this.onResetZoom,
    required this.onClose,
  });

  final bool isFiltered;
  final bool hasAnomalies;
  final bool isTailing;
  final VoidCallback onResetZoom;
  final VoidCallback? onClose;

  @override
  Widget build(BuildContext context) {
    return Container(
      height: 40,
      padding: const EdgeInsets.symmetric(horizontal: AppSpacing.md),
      decoration: const BoxDecoration(
        border: Border(bottom: BorderSide(color: AppColors.borderSubtle)),
      ),
      child: Row(
        children: [
          Text(
            "DISTRIBUTION INSIGHTS",
            style: AppTypography.labelCaps.copyWith(fontSize: 10),
          ),
          if (isFiltered) ...[
            const SizedBox(width: AppSpacing.sm),
            _ResetZoomChip(onTap: onResetZoom),
          ],
          const Spacer(),
          if (hasAnomalies) ...[
            const _Badge(
              key: Key("logDistributionSpikeBadge"),
              color: AppColors.error,
              label: "Spike Detected",
            ),
            const SizedBox(width: AppSpacing.sm),
          ],
          if (isTailing) ...[
            const _Badge(
              key: Key("logDistributionLiveBadge"),
              color: AppColors.primary,
              label: "Live Flow",
            ),
            const SizedBox(width: AppSpacing.sm),
          ],
          if (onClose != null)
            IconButton(
              key: const Key("logDistributionCloseButton"),
              tooltip: "Close Chart",
              icon: const Icon(Icons.close, size: 16),
              color: AppColors.textMuted,
              onPressed: onClose,
            ),
        ],
      ),
    );
  }
}

class _ResetZoomChip extends StatelessWidget {
  const _ResetZoomChip({required this.onTap});

  final VoidCallback onTap;

  @override
  Widget build(BuildContext context) {
    return Material(
      color: AppColors.primary.withValues(alpha: 0.1),
      borderRadius: BorderRadius.circular(4),
      child: InkWell(
        key: const Key("logDistributionResetZoomButton"),
        onTap: onTap,
        borderRadius: BorderRadius.circular(4),
        child: Container(
          padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 3),
          decoration: BoxDecoration(
            border: Border.all(color: AppColors.primary.withValues(alpha: 0.2)),
            borderRadius: BorderRadius.circular(4),
          ),
          child: Row(
            mainAxisSize: MainAxisSize.min,
            children: const [
              Icon(Icons.zoom_in, size: 10, color: AppColors.primary),
              SizedBox(width: 4),
              Text(
                "Reset Zoom",
                style: TextStyle(fontSize: 10, fontWeight: FontWeight.w700, color: AppColors.primary),
              ),
            ],
          ),
        ),
      ),
    );
  }
}

class _Badge extends StatelessWidget {
  const _Badge({super.key, required this.color, required this.label});

  final Color color;
  final String label;

  @override
  Widget build(BuildContext context) {
    return Container(
      padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 3),
      decoration: BoxDecoration(
        color: color.withValues(alpha: 0.1),
        border: Border.all(color: color.withValues(alpha: 0.2)),
        borderRadius: BorderRadius.circular(999),
      ),
      child: Row(
        mainAxisSize: MainAxisSize.min,
        children: [
          Container(width: 6, height: 6, decoration: BoxDecoration(color: color, shape: BoxShape.circle)),
          const SizedBox(width: 6),
          Text(label, style: TextStyle(fontSize: 10, fontWeight: FontWeight.w700, color: color)),
        ],
      ),
    );
  }
}

class _HistogramChart extends StatelessWidget {
  const _HistogramChart({required this.buckets, required this.anomalyIndices, required this.onBarTap});

  final List<DistributionBucket> buckets;
  final Set<int> anomalyIndices;
  final ValueChanged<int> onBarTap;

  static String _tooltipFor(DistributionBucket b) {
    final buf = StringBuffer(b.bucket)..write("\n");
    for (final e in _orderedLevels(b.levelCounts)) {
      buf.write("${e.key}: ${e.value}\n");
    }
    buf.write("Click to zoom into this window");
    return buf.toString();
  }

  @override
  Widget build(BuildContext context) {
    final maxTotal = buckets.fold<int>(0, (m, b) => b.total > m ? b.total : m);
    return LayoutBuilder(
      builder: (context, constraints) {
        final maxBarHeight = constraints.maxHeight;
        return Row(
          crossAxisAlignment: CrossAxisAlignment.end,
          children: [
            for (var i = 0; i < buckets.length; i++)
              Expanded(
                child: Padding(
                  padding: const EdgeInsets.symmetric(horizontal: 1),
                  child: Tooltip(
                    message: _tooltipFor(buckets[i]),
                    child: GestureDetector(
                      key: Key("logDistributionBar_$i"),
                      behavior: HitTestBehavior.opaque,
                      onTap: () => onBarTap(i),
                      child: _StackedSegments(
                        bucket: buckets[i],
                        maxTotal: maxTotal,
                        maxHeight: maxBarHeight,
                        hasAnomaly: anomalyIndices.contains(i),
                      ),
                    ),
                  ),
                ),
              ),
          ],
        );
      },
    );
  }
}

class _StackedSegments extends StatelessWidget {
  const _StackedSegments({
    required this.bucket,
    required this.maxTotal,
    required this.maxHeight,
    required this.hasAnomaly,
  });

  final DistributionBucket bucket;
  final int maxTotal;
  final double maxHeight;
  final bool hasAnomaly;

  @override
  Widget build(BuildContext context) {
    final levels = _orderedLevels(bucket.levelCounts);
    if (levels.isEmpty || maxHeight <= 0) {
      return const SizedBox(height: 2);
    }

    final stack = Column(
      mainAxisSize: MainAxisSize.min,
      children: [
        for (final entry in levels)
          Container(
            height: maxTotal > 0
                ? ((entry.value / maxTotal) * maxHeight).clamp(2.0, maxHeight)
                : 2.0,
            color: AppColors.forLogLevel(entry.key),
          ),
      ],
    );

    if (!hasAnomaly) return stack;
    // DecoratedBox (not Container) -- Container's decoration implicitly pads
    // its child by the border width to keep the border from overlapping
    // content, which here would push `stack` (already sized to exactly fill
    // its allotted height) past its constraints. DecoratedBox paints the
    // same border without reserving extra layout space.
    return DecoratedBox(
      decoration: BoxDecoration(border: Border.all(color: AppColors.textPrimary, width: 2)),
      child: stack,
    );
  }
}
