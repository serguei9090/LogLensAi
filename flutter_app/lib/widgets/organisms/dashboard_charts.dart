/// Dart port of `src/components/organisms/DashboardCharts.tsx`.
///
/// The React source wraps a single Apache ECharts stacked-bar time-series
/// chart (log volume by severity, bucketed at `bucketInterval`) with
/// drag-to-select (ECharts' `brush` feature) and click-to-drill-down
/// interactions, plus a header legend row (colored dot + count + percentage
/// per DEBUG/INFO/WARN/ERROR).
///
/// This port keeps that chart (see [_VolumeOverTimeChart]) with equivalent
/// interactions rebuilt on `fl_chart`'s native touch system (see the
/// deviation note on [_DashboardChartsState._handleBarTouch]), and adds two
/// charts the React source doesn't have standalone widgets for but that the
/// same `stats` payload supports: a level-distribution pie ([_LevelDistributionChart])
/// and an error-rate trend line ([_ErrorRateTrendChart], ERROR+FATAL/total
/// per bucket) -- both requested for this Flutter pass specifically, and
/// both colored via [AppColors.forLogLevel]/[AppColors.error] to stay
/// on-palette with the rest of the app.
library;

import "dart:math" as math;

import "package:fl_chart/fl_chart.dart";
import "package:flutter/material.dart";

import "../../models/dashboard_stats.dart";
import "../../theme/app_theme.dart";
import "../atoms/app_chart_container.dart";

/// Mirrors the React prop's inline `{ start: string; end: string }` shape
/// for `DashboardChartsProps.timeRange` -- the dashboard's currently active
/// time window, used only to decide whether a "Reset Zoom" affordance
/// should show (i.e. whether the window differs from [DashboardTimeBounds]).
class DashboardTimeRange {
  const DashboardTimeRange({this.start = "", this.end = ""});

  final String start;
  final String end;
}

const List<String> _kDisplayLevels = ["DEBUG", "INFO", "WARN", "ERROR"];

class DashboardCharts extends StatefulWidget {
  const DashboardCharts({
    super.key,
    required this.stats,
    this.bucketInterval = "1 hour",
    this.timeBounds,
    this.timeRange = const DashboardTimeRange(),
    required this.onZoom,
    required this.onReset,
  });

  /// Dashboard aggregate stats, or null while loading (renders
  /// [AppChartContainer]'s loading overlay instead of the React skeleton
  /// bars -- see that widget's doc comment: it was built anticipating this
  /// exact use).
  final DashboardStats? stats;

  /// ISO interval string returned by the backend, e.g. "1 hour", "15 minutes".
  final String bucketInterval;

  /// Min/max of actual data returned by the backend, for the All-Time reset.
  final DashboardTimeBounds? timeBounds;

  /// Currently active time range on the dashboard.
  final DashboardTimeRange timeRange;

  /// Called when the user drills into a range (bar tap or drag-select),
  /// with nominal-ISO (no timezone conversion) start/end strings.
  final void Function(String start, String end) onZoom;

  /// Called when the user resets to All Time.
  final VoidCallback onReset;

  @override
  State<DashboardCharts> createState() => _DashboardChartsState();
}

class _DashboardChartsState extends State<DashboardCharts> {
  int? _dragStartIndex;
  int? _dragEndIndex;

  List<DashboardTimeSeriesPoint> get _chartData => widget.stats?.timeSeries ?? const [];

  bool get _isFiltered {
    final bounds = widget.timeBounds;
    if (bounds == null || bounds.min.isEmpty || bounds.max.isEmpty) {
      return widget.timeRange.start.isNotEmpty || widget.timeRange.end.isNotEmpty;
    }
    return (widget.timeRange.start.isNotEmpty && widget.timeRange.start != bounds.min) ||
        (widget.timeRange.end.isNotEmpty && widget.timeRange.end != bounds.max);
  }

  Map<String, int> get _aggregatedCounts {
    final lc = widget.stats?.levelCounts ?? const <String, int>{};
    int g(String key) => lc[key] ?? 0;
    return {
      "DEBUG": g("DEBUG") + g("debug"),
      "INFO": g("INFO") + g("info"),
      "WARN": g("WARN") + g("WARNING") + g("warn"),
      "ERROR": g("ERROR") + g("FATAL") + g("CRITICAL") + g("error"),
    };
  }

  // ── Drag-to-zoom & click handlers ────────────────────────────────────────
  //
  // Deviation from React: the React source uses ECharts' `brush` extension
  // (`dispatchAction({ type: "takeBrush" })`) for drag-to-select, which has
  // no fl_chart equivalent. Instead this reproduces the same UX using
  // fl_chart's native touch pipeline directly: [BarTouchData.touchCallback]
  // receives real [FlPanStartEvent]/[FlPanUpdateEvent]/[FlPanEndEvent]
  // (fl_chart wires a genuine `PanGestureRecognizer` into every axis chart,
  // not just a tap recognizer -- see `RenderBaseChart.initGestureRecognizers`
  // in the fl_chart source), each carrying a [BarTouchResponse] whose
  // `spot.touchedBarGroupIndex` tells us which bucket is under the pointer.
  // A pan start/end pair with different indices is a drag-select (-> onZoom
  // over the full sorted range); a bare tap-up on a bar is a single-bucket
  // drill-down, matching the React source's `click` handler exactly.
  void _handleBarTouch(FlTouchEvent event, BarTouchResponse? response) {
    final data = _chartData;
    if (data.isEmpty) return;
    final index = response?.spot?.touchedBarGroupIndex;

    if (event is FlPanStartEvent) {
      if (index != null && index >= 0) {
        _dragStartIndex = index;
        _dragEndIndex = index;
      }
    } else if (event is FlPanUpdateEvent) {
      if (_dragStartIndex != null && index != null && index >= 0) {
        _dragEndIndex = index;
      }
    } else if (event is FlPanEndEvent || event is FlPanCancelEvent) {
      final start = _dragStartIndex;
      final end = _dragEndIndex;
      _dragStartIndex = null;
      _dragEndIndex = null;
      if (start != null && end != null && start != end) {
        _emitRangeZoom(math.min(start, end), math.max(start, end));
      }
    } else if (event is FlTapUpEvent) {
      if (index != null && index >= 0 && index < data.length) {
        _emitSingleZoom(index);
      }
    }
  }

  void _emitSingleZoom(int index) {
    final ts = _chartData[index].timestamp;
    widget.onZoom(_padToIso(ts), _addInterval(ts, widget.bucketInterval));
  }

  void _emitRangeZoom(int startIndex, int endIndex) {
    final data = _chartData;
    final startTs = data[startIndex].timestamp;
    final endTs = data[endIndex].timestamp;
    widget.onZoom(_padToIso(startTs), _padToIso(_addInterval(endTs, widget.bucketInterval)));
  }

  @override
  Widget build(BuildContext context) {
    final counts = _aggregatedCounts;
    final totalLogs = widget.stats?.totalLogs ?? 0;

    return Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        Wrap(
          alignment: WrapAlignment.spaceBetween,
          crossAxisAlignment: WrapCrossAlignment.center,
          spacing: AppSpacing.md,
          runSpacing: AppSpacing.sm,
          children: [
            Row(
              mainAxisSize: MainAxisSize.min,
              children: [
                const Icon(Icons.history, size: 16, color: AppColors.primary),
                const SizedBox(width: AppSpacing.xs),
                Text(
                  "SEVERITY OVER TIME",
                  style: AppTypography.labelCaps,
                ),
                const SizedBox(width: AppSpacing.xs),
                _IntervalBadge(bucketInterval: widget.bucketInterval),
                if (_isFiltered) ...[
                  const SizedBox(width: AppSpacing.sm),
                  _ResetZoomButton(onTap: widget.onReset),
                ],
              ],
            ),
            Wrap(
              spacing: AppSpacing.md,
              runSpacing: AppSpacing.xs,
              crossAxisAlignment: WrapCrossAlignment.center,
              children: [
                for (final level in _kDisplayLevels)
                  _LegendEntry(
                    level: level,
                    count: counts[level] ?? 0,
                    totalLogs: totalLogs,
                  ),
              ],
            ),
          ],
        ),
        const SizedBox(height: AppSpacing.xs),
        Text(
          "Click a bar to drill down · Drag to select a range",
          style: AppTypography.log.copyWith(
            fontSize: 9,
            color: AppColors.textMuted.withValues(alpha: 0.4),
          ),
        ),
        const SizedBox(height: AppSpacing.sm),
        AppChartContainer(
          height: 260,
          padding: const EdgeInsets.fromLTRB(4, AppSpacing.sm, AppSpacing.md, 4),
          loading: widget.stats == null,
          child: _VolumeOverTimeChart(
            data: _chartData,
            onTouch: _handleBarTouch,
          ),
        ),
        const SizedBox(height: AppSpacing.md),
        LayoutBuilder(
          builder: (context, constraints) {
            final stacked = constraints.maxWidth < 640;
            final levelChart = AppChartContainer(
              height: 220,
              loading: widget.stats == null,
              child: _LevelDistributionChart(counts: counts),
            );
            final errorChart = AppChartContainer(
              height: 220,
              loading: widget.stats == null,
              child: _ErrorRateTrendChart(data: _chartData),
            );
            if (stacked) {
              return Column(
                children: [
                  levelChart,
                  const SizedBox(height: AppSpacing.md),
                  errorChart,
                ],
              );
            }
            return Row(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Expanded(child: levelChart),
                const SizedBox(width: AppSpacing.md),
                Expanded(child: errorChart),
              ],
            );
          },
        ),
      ],
    );
  }
}

// ── Chart 1: Log volume over time (stacked bar) ────────────────────────────

class _VolumeOverTimeChart extends StatelessWidget {
  const _VolumeOverTimeChart({required this.data, required this.onTouch});

  final List<DashboardTimeSeriesPoint> data;
  final void Function(FlTouchEvent event, BarTouchResponse? response) onTouch;

  double _maxY() {
    var m = 0.0;
    for (final p in data) {
      final total = p.total.toDouble();
      if (total > m) m = total;
    }
    return m <= 0 ? 10 : m * 1.15;
  }

  @override
  Widget build(BuildContext context) {
    if (data.isEmpty) {
      return Center(
        child: Text(
          "NO TIME DATA AVAILABLE",
          style: AppTypography.log.copyWith(fontSize: 10, color: AppColors.textMuted),
        ),
      );
    }

    final n = data.length;
    final step = (n / 6).ceil().clamp(1, n);

    return LayoutBuilder(
      builder: (context, constraints) {
        final barWidth = n > 0
            ? (constraints.maxWidth / n * 0.55).clamp(2.0, 28.0)
            : 14.0;

        return BarChart(
          BarChartData(
            alignment: BarChartAlignment.spaceBetween,
            groupsSpace: 2,
            maxY: _maxY(),
            minY: 0,
            barTouchData: BarTouchData(
              enabled: true,
              handleBuiltInTouches: true,
              touchCallback: onTouch,
              touchTooltipData: BarTouchTooltipData(
                getTooltipColor: (_) => AppColors.bgTooltip,
                tooltipBorder: const BorderSide(color: AppColors.border),
                tooltipRoundedRadius: 8,
                getTooltipItem: (group, groupIndex, rod, rodIndex) {
                  if (groupIndex < 0 || groupIndex >= data.length) return null;
                  final p = data[groupIndex];
                  final rows = [
                    ["DEBUG", p.debug, AppColors.forLogLevel("DEBUG")],
                    ["INFO", p.info, AppColors.forLogLevel("INFO")],
                    ["WARN", p.warn, AppColors.forLogLevel("WARN")],
                    ["ERROR", p.error, AppColors.forLogLevel("ERROR")],
                  ];
                  return BarTooltipItem(
                    "${p.timestamp}\n",
                    AppTypography.log.copyWith(
                      fontSize: 10,
                      fontWeight: FontWeight.w700,
                      color: AppColors.primary,
                    ),
                    children: [
                      for (final row in rows)
                        TextSpan(
                          text: "\n${row[0]}  ${row[1]}",
                          style: AppTypography.log.copyWith(
                            fontSize: 10,
                            color: row[2] as Color,
                          ),
                        ),
                      TextSpan(
                        text: "\nTOTAL  ${p.total}",
                        style: AppTypography.log.copyWith(
                          fontSize: 10,
                          fontWeight: FontWeight.w700,
                          color: AppColors.textSecondary,
                        ),
                      ),
                    ],
                  );
                },
              ),
            ),
            gridData: FlGridData(
              show: true,
              drawVerticalLine: false,
              getDrawingHorizontalLine: (_) =>
                  FlLine(color: AppColors.borderMuted, strokeWidth: 1, dashArray: const [4, 4]),
            ),
            borderData: FlBorderData(show: false),
            titlesData: FlTitlesData(
              topTitles: const AxisTitles(sideTitles: SideTitles(showTitles: false)),
              rightTitles: const AxisTitles(sideTitles: SideTitles(showTitles: false)),
              leftTitles: AxisTitles(
                sideTitles: SideTitles(
                  showTitles: true,
                  reservedSize: 34,
                  getTitlesWidget: (value, meta) => Padding(
                    padding: const EdgeInsets.only(right: 4),
                    child: Text(
                      value.toInt().toString(),
                      style: AppTypography.log.copyWith(fontSize: 9, color: AppColors.textMuted),
                    ),
                  ),
                ),
              ),
              bottomTitles: AxisTitles(
                sideTitles: SideTitles(
                  showTitles: true,
                  reservedSize: 22,
                  interval: step.toDouble(),
                  getTitlesWidget: (value, meta) {
                    final idx = value.round();
                    if (idx < 0 || idx >= data.length) return const SizedBox.shrink();
                    return SideTitleWidget(
                      axisSide: meta.axisSide,
                      child: Text(
                        _shortTimeLabel(data[idx].timestamp),
                        style: AppTypography.log.copyWith(fontSize: 8, color: AppColors.textMuted),
                      ),
                    );
                  },
                ),
              ),
            ),
            barGroups: [
              for (var i = 0; i < data.length; i++) _buildGroup(i, data[i], barWidth),
            ],
          ),
        );
      },
    );
  }

  BarChartGroupData _buildGroup(int index, DashboardTimeSeriesPoint p, double barWidth) {
    final debug = p.debug.toDouble();
    final info = p.info.toDouble();
    final warn = p.warn.toDouble();
    final error = p.error.toDouble();
    final total = debug + info + warn + error;
    return BarChartGroupData(
      x: index,
      barRods: [
        BarChartRodData(
          toY: total,
          width: barWidth,
          borderRadius: const BorderRadius.vertical(top: Radius.circular(3)),
          rodStackItems: [
            BarChartRodStackItem(0, debug, AppColors.forLogLevel("DEBUG")),
            BarChartRodStackItem(debug, debug + info, AppColors.forLogLevel("INFO")),
            BarChartRodStackItem(debug + info, debug + info + warn, AppColors.forLogLevel("WARN")),
            BarChartRodStackItem(debug + info + warn, total, AppColors.forLogLevel("ERROR")),
          ],
        ),
      ],
    );
  }
}

// ── Chart 2: Log level distribution (pie) ───────────────────────────────────

class _LevelDistributionChart extends StatelessWidget {
  const _LevelDistributionChart({required this.counts});

  final Map<String, int> counts;

  @override
  Widget build(BuildContext context) {
    final total = counts.values.fold<int>(0, (a, b) => a + b);

    return Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        Row(
          children: [
            const Icon(Icons.pie_chart_outline, size: 14, color: AppColors.primary),
            const SizedBox(width: AppSpacing.xs),
            Text("LEVEL DISTRIBUTION", style: AppTypography.labelCaps.copyWith(fontSize: 9)),
          ],
        ),
        const SizedBox(height: AppSpacing.sm),
        Expanded(
          child: total <= 0
              ? Center(
                  child: Text(
                    "NO DATA",
                    style: AppTypography.log.copyWith(fontSize: 10, color: AppColors.textMuted),
                  ),
                )
              : Row(
                  children: [
                    Expanded(
                      child: PieChart(
                        PieChartData(
                          sections: [
                            for (final level in _kDisplayLevels)
                              if ((counts[level] ?? 0) > 0)
                                PieChartSectionData(
                                  value: (counts[level] ?? 0).toDouble(),
                                  color: AppColors.forLogLevel(level),
                                  radius: 44,
                                  title:
                                      "${(((counts[level] ?? 0) / total) * 100).toStringAsFixed(0)}%",
                                  titleStyle: AppTypography.log.copyWith(
                                    fontSize: 9,
                                    fontWeight: FontWeight.w700,
                                    color: AppColors.textInverse,
                                  ),
                                ),
                          ],
                          sectionsSpace: 2,
                          centerSpaceRadius: 26,
                        ),
                      ),
                    ),
                    const SizedBox(width: AppSpacing.sm),
                    Column(
                      mainAxisSize: MainAxisSize.min,
                      crossAxisAlignment: CrossAxisAlignment.start,
                      children: [
                        for (final level in _kDisplayLevels)
                          _LegendEntry(level: level, count: counts[level] ?? 0, totalLogs: total),
                      ],
                    ),
                  ],
                ),
        ),
      ],
    );
  }
}

// ── Chart 3: Error rate trend (line) ────────────────────────────────────────

class _ErrorRateTrendChart extends StatelessWidget {
  const _ErrorRateTrendChart({required this.data});

  final List<DashboardTimeSeriesPoint> data;

  static double _errorRatePct(DashboardTimeSeriesPoint p) {
    final total = p.total;
    if (total <= 0) return 0;
    return (p.error / total) * 100;
  }

  @override
  Widget build(BuildContext context) {
    return Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        Row(
          children: [
            const Icon(Icons.show_chart, size: 14, color: AppColors.error),
            const SizedBox(width: AppSpacing.xs),
            Text("ERROR RATE TREND", style: AppTypography.labelCaps.copyWith(fontSize: 9)),
          ],
        ),
        const SizedBox(height: AppSpacing.sm),
        Expanded(
          child: data.isEmpty
              ? Center(
                  child: Text(
                    "NO TIME DATA AVAILABLE",
                    style: AppTypography.log.copyWith(fontSize: 10, color: AppColors.textMuted),
                  ),
                )
              : LineChart(
                  LineChartData(
                    minY: 0,
                    maxY: 100,
                    lineTouchData: LineTouchData(
                      touchTooltipData: LineTouchTooltipData(
                        getTooltipColor: (_) => AppColors.bgTooltip,
                        getTooltipItems: (spots) => [
                          for (final spot in spots)
                            LineTooltipItem(
                              "${spot.y.toStringAsFixed(1)}%",
                              AppTypography.log.copyWith(fontSize: 10, color: AppColors.error),
                            ),
                        ],
                      ),
                    ),
                    gridData: FlGridData(
                      show: true,
                      drawVerticalLine: false,
                      horizontalInterval: 25,
                      getDrawingHorizontalLine: (_) =>
                          FlLine(color: AppColors.borderMuted, strokeWidth: 1, dashArray: const [4, 4]),
                    ),
                    borderData: FlBorderData(show: false),
                    titlesData: FlTitlesData(
                      topTitles: const AxisTitles(sideTitles: SideTitles(showTitles: false)),
                      rightTitles: const AxisTitles(sideTitles: SideTitles(showTitles: false)),
                      bottomTitles: const AxisTitles(sideTitles: SideTitles(showTitles: false)),
                      leftTitles: AxisTitles(
                        sideTitles: SideTitles(
                          showTitles: true,
                          reservedSize: 32,
                          interval: 25,
                          getTitlesWidget: (value, meta) => Text(
                            "${value.toInt()}%",
                            style: AppTypography.log.copyWith(fontSize: 9, color: AppColors.textMuted),
                          ),
                        ),
                      ),
                    ),
                    lineBarsData: [
                      LineChartBarData(
                        spots: [
                          for (var i = 0; i < data.length; i++)
                            FlSpot(i.toDouble(), _errorRatePct(data[i])),
                        ],
                        isCurved: true,
                        color: AppColors.error,
                        barWidth: 2,
                        dotData: const FlDotData(show: false),
                        belowBarData: BarAreaData(
                          show: true,
                          color: AppColors.error.withValues(alpha: 0.1),
                        ),
                      ),
                    ],
                  ),
                ),
        ),
      ],
    );
  }
}

// ── Shared small widgets ────────────────────────────────────────────────────

class _IntervalBadge extends StatelessWidget {
  const _IntervalBadge({required this.bucketInterval});

  final String bucketInterval;

  @override
  Widget build(BuildContext context) {
    return Container(
      padding: const EdgeInsets.symmetric(horizontal: 4, vertical: 1),
      decoration: BoxDecoration(
        border: Border.all(color: AppColors.border.withValues(alpha: 0.3)),
        borderRadius: BorderRadius.circular(3),
      ),
      child: Text(
        "$bucketInterval/bar",
        style: AppTypography.log.copyWith(fontSize: 9, color: AppColors.textMuted.withValues(alpha: 0.6)),
      ),
    );
  }
}

class _ResetZoomButton extends StatelessWidget {
  const _ResetZoomButton({required this.onTap});

  final VoidCallback onTap;

  @override
  Widget build(BuildContext context) {
    return Material(
      color: AppColors.primary.withValues(alpha: 0.1),
      borderRadius: BorderRadius.circular(4),
      child: InkWell(
        onTap: onTap,
        borderRadius: BorderRadius.circular(4),
        child: Container(
          padding: const EdgeInsets.symmetric(horizontal: 6, vertical: 3),
          decoration: BoxDecoration(
            border: Border.all(color: AppColors.primary.withValues(alpha: 0.2)),
            borderRadius: BorderRadius.circular(4),
          ),
          child: Row(
            mainAxisSize: MainAxisSize.min,
            children: [
              const Icon(Icons.zoom_in, size: 11, color: AppColors.primary),
              const SizedBox(width: 4),
              Text(
                "Reset Zoom",
                style: AppTypography.log.copyWith(
                  fontSize: 10,
                  fontWeight: FontWeight.w600,
                  color: AppColors.primary,
                ),
              ),
            ],
          ),
        ),
      ),
    );
  }
}

class _LegendEntry extends StatelessWidget {
  const _LegendEntry({required this.level, required this.count, required this.totalLogs});

  final String level;
  final int count;
  final int totalLogs;

  @override
  Widget build(BuildContext context) {
    final pct = totalLogs > 0 ? ((count / totalLogs) * 100).toStringAsFixed(1) : "0.0";
    return Padding(
      padding: const EdgeInsets.symmetric(vertical: 2),
      child: Row(
        mainAxisSize: MainAxisSize.min,
        children: [
          Container(
            width: 8,
            height: 8,
            decoration: BoxDecoration(
              color: AppColors.forLogLevel(level),
              shape: BoxShape.circle,
            ),
          ),
          const SizedBox(width: 6),
          Text(
            level,
            style: AppTypography.log.copyWith(
              fontSize: 10,
              fontWeight: FontWeight.w700,
              color: AppColors.textPrimary,
            ),
          ),
          const SizedBox(width: 4),
          Text(
            count.toString(),
            style: AppTypography.log.copyWith(fontSize: 10, color: AppColors.textSecondary),
          ),
          const SizedBox(width: 2),
          Text(
            "($pct%)",
            style: AppTypography.log.copyWith(
              fontSize: 9,
              color: AppColors.textMuted.withValues(alpha: 0.7),
            ),
          ),
        ],
      ),
    );
  }
}

// ── Timestamp helpers (ports of DashboardCharts.tsx's date utilities) ──────

DateTime _parseDbDate(String str) {
  final normalized = str.replaceAll("T", " ");
  final segs = normalized.split(" ");
  final dateSegs = segs[0].split("-");
  final year = int.tryParse(dateSegs.isNotEmpty ? dateSegs[0] : "") ?? 1970;
  final month = dateSegs.length > 1 ? int.tryParse(dateSegs[1]) ?? 1 : 1;
  final day = dateSegs.length > 2 ? int.tryParse(dateSegs[2]) ?? 1 : 1;
  final timePart = segs.length > 1 ? segs[1] : "00:00:00";
  final timeSegs = timePart.split(":");
  final hour = timeSegs.isNotEmpty ? int.tryParse(timeSegs[0]) ?? 0 : 0;
  final minute = timeSegs.length > 1 ? int.tryParse(timeSegs[1]) ?? 0 : 0;
  final second = timeSegs.length > 2 ? int.tryParse(timeSegs[2]) ?? 0 : 0;
  return DateTime(year, month, day, hour, minute, second);
}

String _formatToDbString(DateTime d) {
  String pad2(int n) => n.toString().padLeft(2, "0");
  final y = d.year.toString().padLeft(4, "0");
  return "$y-${pad2(d.month)}-${pad2(d.day)}T${pad2(d.hour)}:${pad2(d.minute)}:${pad2(d.second)}";
}

const Map<String, int> _kIntervalMs = {
  "1 second": 1000,
  "5 seconds": 5000,
  "15 seconds": 15000,
  "1 minute": 60000,
  "5 minutes": 300000,
  "15 minutes": 900000,
  "1 hour": 3600000,
  "4 hours": 14400000,
  "12 hours": 43200000,
  "1 day": 86400000,
  "30 days": 2592000000,
};

/// Parses a bucket-format label and adds one interval step, mirroring the
/// React source's `addInterval` without timezone shifting.
String _addInterval(String label, String interval) {
  final start = _parseDbDate(label);
  final delta = _kIntervalMs[interval] ?? 3600000;
  final end = start.add(Duration(milliseconds: delta - 1));
  return _formatToDbString(end);
}

String _padToIso(String ts) {
  final n = ts.replaceAll(" ", "T");
  if (n.length == 10) return "${n}T00:00:00";
  if (n.length == 13) return "$n:00:00";
  if (n.length == 16) return "$n:00";
  return n;
}

/// Simplified bottom-axis label -- the React source shows a two-line
/// time+date label with the date only appearing when it changes between
/// adjacent buckets (rich-text `formatter` + ECharts `rich` styling). That
/// level of layout control isn't exposed the same way through fl_chart's
/// `getTitlesWidget`, so this collapses to a single-line HH:mm (or the raw
/// bucket string for coarser day/month buckets where there's no time part).
String _shortTimeLabel(String timestamp) {
  final normalized = timestamp.replaceAll("T", " ");
  final parts = normalized.split(" ");
  if (parts.length < 2) return parts[0];
  final timeParts = parts[1].split(":");
  if (timeParts.length < 2) return parts[1];
  return "${timeParts[0]}:${timeParts[1]}";
}
