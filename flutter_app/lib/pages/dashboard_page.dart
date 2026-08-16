/// Dart port of `src/components/pages/DashboardPage.tsx`.
///
/// Composes the already-built Phase 5 tiers into the real Dashboard screen:
/// header (title + refresh), a workspace/source/time-range filter bar,
/// [StatCard] KPI row, the [DashboardCharts] organism, top-error/top-noise
/// [ClusterRow] lists, a source-activity heatmap grid, the
/// [DashboardModeToggle] (Static <-> AI Insights), and -- in AI mode -- the
/// pinned-widget canvas plus the reused [AIInvestigationSidebar].
///
/// State split (see `providers/dashboard_provider.dart`'s doc comment for
/// the full rationale): `get_dashboard_stats`'s fetch + result live in
/// [dashboardProvider] (a [StateNotifierProvider], matching this codebase's
/// established `HealthNotifier`/`WorkspaceNotifier` shape); the *filter*
/// selection (workspace/source/time-range/mode) is this page's own local
/// [State], mirroring the React source's `useDashboardData` local
/// `useState`s -- nothing outside this page reads those.
///
/// Deviations from the React source (each also called out at its call
/// site):
///  - No ECharts-brush-derived drag-to-zoom UI chrome beyond what
///    [DashboardCharts] itself already reimplements on fl_chart's native
///    touch pipeline (see that organism's doc comment).
///  - Cluster-row/heatmap loading skeletons are static placeholder boxes,
///    not the React version's `animate-pulse` shimmer -- no visual
///    difference in a static widget-test screenshot, just no CSS-style
///    keyframe animation wired up.
///  - The AI-mode canvas lays pinned A2UI widgets out with a plain
///    [GridView], not the React version's lazy `useInView`-gated mounting
///    -- Flutter's `GridView.builder` already only builds visible items,
///    so the manual viewport-visibility gate has no equivalent need here.
library;

import "dart:async";

import "package:flutter/material.dart";
import "package:flutter_riverpod/flutter_riverpod.dart";

import "../models/cluster.dart";
import "../models/dashboard_stats.dart";
import "../models/workspace.dart";
import "../providers/ai_provider.dart";
import "../providers/dashboard_provider.dart";
import "../providers/workspace_provider.dart";
import "../theme/app_theme.dart";
import "../widgets/atoms/a2ui_renderer.dart";
import "../widgets/atoms/stat_card.dart";
import "../widgets/molecules/cluster_row.dart";
import "../widgets/molecules/dashboard_mode_toggle.dart";
import "../widgets/molecules/time_range_picker.dart";
import "../widgets/organisms/ai_investigation_sidebar.dart";
import "../widgets/organisms/dashboard_charts.dart";

class DashboardPage extends ConsumerStatefulWidget {
  const DashboardPage({super.key});

  @override
  ConsumerState<DashboardPage> createState() => _DashboardPageState();
}

class _DashboardPageState extends ConsumerState<DashboardPage> {
  String _selectedWorkspaceId = "all";
  String _selectedSourceId = "all";
  TimeRange _timeRange = const TimeRange(start: "", end: "");
  DashboardTimeBounds? _timeBounds;
  bool _isFirstLoad = true;
  DashboardMode _mode = DashboardMode.staticMode;

  @override
  void initState() {
    super.initState();
    WidgetsBinding.instance.addPostFrameCallback((_) => _initialFetch());
  }

  Future<void> _initialFetch() async {
    if (!mounted) return;
    final ws = ref.read(workspaceProvider);
    final fallback = ws.activeWorkspaceId.isNotEmpty
        ? ws.activeWorkspaceId
        : (ws.workspaces.isNotEmpty ? ws.workspaces.first.id : "all");
    setState(() => _selectedWorkspaceId = fallback);
    await _fetch();
  }

  Future<void> _fetch() async {
    final ws = ref.read(workspaceProvider);
    final stats = await ref.read(dashboardProvider.notifier).fetchStats(
      workspaceId: _selectedWorkspaceId,
      sourceId: _selectedSourceId,
      startTime: _isFirstLoad ? null : _timeRange.start,
      endTime: _isFirstLoad ? null : _timeRange.end,
      activeWorkspaceIds: [for (final w in ws.workspaces) w.id],
    );
    if (!mounted || stats == null) return;
    if (_isFirstLoad) {
      final bounds = stats.timeBounds;
      if (bounds != null && bounds.min.isNotEmpty && bounds.max.isNotEmpty) {
        setState(() {
          _timeBounds = bounds;
          _timeRange = TimeRange(start: bounds.min, end: bounds.max, label: "All Time");
          _isFirstLoad = false;
        });
      } else {
        setState(() => _isFirstLoad = false);
      }
    }
  }

  void _onWorkspaceChange(String? v) {
    if (v == null || v == _selectedWorkspaceId) return;
    setState(() {
      _selectedWorkspaceId = v;
      _selectedSourceId = "all";
      _timeBounds = null;
      _timeRange = const TimeRange(start: "", end: "");
      _isFirstLoad = true;
    });
    unawaited(_fetch());
  }

  void _onSourceChange(String? v) {
    if (v == null || v == _selectedSourceId) return;
    setState(() => _selectedSourceId = v);
    unawaited(_fetch());
  }

  void _onTimeRangeChange(TimeRange tr) {
    setState(() => _timeRange = tr);
    unawaited(_fetch());
  }

  void _onResetTime() {
    final bounds = _timeBounds;
    setState(() {
      _timeRange = bounds != null
          ? TimeRange(start: bounds.min, end: bounds.max, label: "All Time")
          : const TimeRange(start: "", end: "");
    });
    unawaited(_fetch());
  }

  void _onZoom(String start, String end) {
    setState(() => _timeRange = TimeRange(start: start, end: end, label: "Zoomed Range"));
    unawaited(_fetch());
  }

  bool get _isFiltered {
    final bounds = _timeBounds;
    if (bounds == null || bounds.min.isEmpty || bounds.max.isEmpty) {
      return _timeRange.start.isNotEmpty || _timeRange.end.isNotEmpty;
    }
    return (_timeRange.start.isNotEmpty && _timeRange.start != bounds.min) ||
        (_timeRange.end.isNotEmpty && _timeRange.end != bounds.max);
  }

  void _handleModeChange(DashboardMode mode) {
    setState(() => _mode = mode);
    if (mode == DashboardMode.ai) {
      ref.read(aiProvider.notifier).setSidebarOpen(true);
    }
  }

  Future<List<String>> _fetchClusterSamples(String clusterId, bool isError) {
    return ref.read(dashboardProvider.notifier).fetchClusterSamples(
      workspaceId: _selectedWorkspaceId,
      clusterId: clusterId,
      isError: isError,
    );
  }

  @override
  Widget build(BuildContext context) {
    final dashboardState = ref.watch(dashboardProvider);
    final workspaceState = ref.watch(workspaceProvider);
    final stats = dashboardState.stats;

    Workspace? currentWorkspace;
    for (final w in workspaceState.workspaces) {
      if (w.id == _selectedWorkspaceId) {
        currentWorkspace = w;
        break;
      }
    }
    final sources = currentWorkspace?.sources ?? const <LogSource>[];

    return Scaffold(
      backgroundColor: AppColors.bgBase,
      body: Stack(
        children: [
          Padding(
            padding: const EdgeInsets.all(AppSpacing.xl),
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                _buildHeader(dashboardState.loading),
                const SizedBox(height: AppSpacing.md),
                _buildFilters(workspaceState.workspaces, sources),
                const SizedBox(height: AppSpacing.lg),
                Expanded(
                  child: SingleChildScrollView(
                    child: _mode == DashboardMode.staticMode
                        ? _buildStaticBody(stats)
                        : _buildAiBody(),
                  ),
                ),
              ],
            ),
          ),
          Positioned(
            left: 0,
            right: 0,
            bottom: AppSpacing.lg,
            child: Center(
              child: DashboardModeToggle(mode: _mode, onModeChange: _handleModeChange),
            ),
          ),
        ],
      ),
    );
  }

  // ── Header ──────────────────────────────────────────────────────────

  Widget _buildHeader(bool loading) {
    final title = _mode == DashboardMode.staticMode ? "Dashboard" : "AI Insights";
    final description = _mode == DashboardMode.staticMode
        ? "High-velocity log analytics and system health overview."
        : "Heuristic pattern analysis and anomaly detection.";

    return Row(
      crossAxisAlignment: CrossAxisAlignment.start,
      mainAxisAlignment: MainAxisAlignment.spaceBetween,
      children: [
        Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            Row(
              children: [
                Text(title, style: AppTypography.h1),
                if (_mode == DashboardMode.ai) ...[
                  const SizedBox(width: AppSpacing.sm),
                  const Icon(Icons.auto_awesome, size: 18, color: AppColors.primary),
                ],
              ],
            ),
            const SizedBox(height: 4),
            Text(
              description,
              style: AppTypography.body.copyWith(color: AppColors.textMuted, fontSize: 13),
            ),
          ],
        ),
        IconButton(
          key: const Key("dashboardRefreshButton"),
          tooltip: "Refresh Data",
          onPressed: loading ? null : () => unawaited(_fetch()),
          icon: loading
              ? const SizedBox(
                  width: 16,
                  height: 16,
                  child: CircularProgressIndicator(strokeWidth: 2, color: AppColors.primary),
                )
              : const Icon(Icons.refresh, color: AppColors.textMuted),
        ),
      ],
    );
  }

  // ── Filters ─────────────────────────────────────────────────────────

  Widget _buildFilters(List<Workspace> workspaces, List<LogSource> sources) {
    final hasSelectedWorkspace = workspaces.any((w) => w.id == _selectedWorkspaceId);
    final hasSelectedSource =
        _selectedSourceId == "all" || sources.any((s) => s.id == _selectedSourceId);

    return Container(
      padding: const EdgeInsets.symmetric(horizontal: AppSpacing.sm, vertical: 4),
      decoration: BoxDecoration(
        color: AppColors.bgSurface.withValues(alpha: 0.3),
        border: Border.all(color: AppColors.border.withValues(alpha: 0.5)),
        borderRadius: BorderRadius.circular(AppRadius.xl),
      ),
      child: Wrap(
        crossAxisAlignment: WrapCrossAlignment.center,
        spacing: AppSpacing.md,
        runSpacing: AppSpacing.xs,
        children: [
          Text("CONTEXT:", style: AppTypography.labelCaps),
          DropdownButtonHideUnderline(
            child: DropdownButton<String>(
              key: const Key("dashboardWorkspaceDropdown"),
              value: hasSelectedWorkspace ? _selectedWorkspaceId : null,
              hint: Text(
                "Select Workspace",
                style: AppTypography.body.copyWith(fontSize: 12, color: AppColors.textMuted),
              ),
              dropdownColor: AppColors.bgSurface,
              style: AppTypography.body.copyWith(fontSize: 12, color: AppColors.textSecondary),
              items: [
                for (final w in workspaces) DropdownMenuItem(value: w.id, child: Text(w.name)),
              ],
              onChanged: _onWorkspaceChange,
            ),
          ),
          DropdownButtonHideUnderline(
            child: DropdownButton<String>(
              key: const Key("dashboardSourceDropdown"),
              value: hasSelectedSource ? _selectedSourceId : "all",
              dropdownColor: AppColors.bgSurface,
              style: AppTypography.body.copyWith(fontSize: 12, color: AppColors.textSecondary),
              items: [
                const DropdownMenuItem(value: "all", child: Text("Entire Workspace")),
                for (final s in sources) DropdownMenuItem(value: s.id, child: Text(s.name)),
              ],
              onChanged: _selectedWorkspaceId == "all" ? null : _onSourceChange,
            ),
          ),
          Container(width: 1, height: 16, color: AppColors.border.withValues(alpha: 0.5)),
          Text("TIME:", style: AppTypography.labelCaps),
          if (_isFiltered)
            TextButton(
              key: const Key("dashboardResetTimeButton"),
              onPressed: _onResetTime,
              style: TextButton.styleFrom(
                foregroundColor: AppColors.primary,
                padding: const EdgeInsets.symmetric(horizontal: AppSpacing.sm),
              ),
              child: const Text("All Time"),
            ),
          TimeRangePicker(value: _timeRange, onChange: _onTimeRangeChange),
        ],
      ),
    );
  }

  // ── Static mode body ────────────────────────────────────────────────

  Widget _buildStaticBody(DashboardStats? stats) {
    final hasInsight = stats?.latestInsight != null && stats!.latestInsight!.isNotEmpty;
    return Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        if (hasInsight) ...[
          _AiObservationCard(
            insight: stats.latestInsight!,
            onDeepDive: () => _handleModeChange(DashboardMode.ai),
          ),
          const SizedBox(height: AppSpacing.lg),
        ],
        _buildStatCards(stats),
        const SizedBox(height: AppSpacing.lg),
        DashboardCharts(
          stats: stats,
          bucketInterval: stats?.bucketInterval ?? "1 hour",
          timeBounds: _timeBounds,
          timeRange: DashboardTimeRange(start: _timeRange.start, end: _timeRange.end),
          onZoom: _onZoom,
          onReset: _onResetTime,
        ),
        const SizedBox(height: AppSpacing.lg),
        _ClusterSection(
          title: "TOP ERROR CLUSTERS",
          icon: Icons.warning_amber_rounded,
          iconColor: AppColors.error,
          clusters: stats?.topErrorClusters ?? const [],
          stats: stats,
          workspaceId: _selectedWorkspaceId,
          isError: true,
          emptyLabel: "NO ERRORS DETECTED",
          fetchSamples: _fetchClusterSamples,
        ),
        const SizedBox(height: AppSpacing.md),
        _ClusterSection(
          title: "TOP NOISE GENERATORS",
          icon: Icons.error_outline,
          iconColor: AppColors.debug,
          clusters: stats?.topClusters ?? const [],
          stats: stats,
          workspaceId: _selectedWorkspaceId,
          isError: false,
          emptyLabel: "NO CLUSTERS",
          fetchSamples: _fetchClusterSamples,
        ),
        const SizedBox(height: AppSpacing.lg),
        _SourceHeatmapSection(stats: stats),
        const SizedBox(height: 96), // keeps content clear of the floating mode toggle
      ],
    );
  }

  Widget _buildStatCards(DashboardStats? stats) {
    final loading = stats == null;
    return LayoutBuilder(
      builder: (context, constraints) {
        final cols = constraints.maxWidth > 900
            ? 5
            : constraints.maxWidth > 620
            ? 3
            : constraints.maxWidth > 380
            ? 2
            : 1;
        final cardWidth = (constraints.maxWidth - AppSpacing.md * (cols - 1)) / cols;
        final cards = <Widget>[
          StatCard(
            icon: const Icon(Icons.storage, size: 16, color: AppColors.primary),
            label: "Total Index",
            value: stats?.totalLogs.toString() ?? "0",
            subValue: "Records in context",
            loading: loading,
          ),
          StatCard(
            icon: const Icon(Icons.layers, size: 16, color: AppColors.debug),
            label: "Patterns",
            value: stats?.totalClusters.toString() ?? "0",
            subValue: "Drain3 Templates",
            loading: loading,
          ),
          StatCard(
            icon: const Icon(Icons.sensors, size: 16, color: AppColors.primary),
            label: "Live Streams",
            value: stats?.activeTailers.toString() ?? "0",
            subValue: "Active ingestion",
            loading: loading,
          ),
          StatCard(
            icon: const Icon(Icons.storage, size: 16, color: AppColors.info),
            label: "Catalogs",
            value: stats?.workspaceCount.toString() ?? "0",
            subValue: "Active workspaces",
            loading: loading,
          ),
          StatCard(
            icon: const Icon(Icons.trending_up, size: 16, color: AppColors.primary),
            label: "Drift",
            value: stats?.newPatternsCount.toString() ?? "0",
            subValue: "New Patterns",
            trend: stats != null && stats.newPatternsCount > 0 ? StatTrend.up : StatTrend.stable,
            loading: loading,
          ),
        ];
        return Wrap(
          spacing: AppSpacing.md,
          runSpacing: AppSpacing.md,
          children: [for (final c in cards) SizedBox(width: cardWidth, child: c)],
        );
      },
    );
  }

  // ── AI mode body ────────────────────────────────────────────────────

  Widget _buildAiBody() {
    final aiState = ref.watch(aiProvider);
    final widgets = aiState.dashboardWidgets;

    return SizedBox(
      height: 560,
      child: Row(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Expanded(
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Row(
                  mainAxisAlignment: MainAxisAlignment.spaceBetween,
                  children: [
                    Row(
                      children: [
                        const Icon(Icons.auto_awesome, size: 18, color: AppColors.primary),
                        const SizedBox(width: AppSpacing.xs),
                        Text("AI DASHBOARD CANVAS", style: AppTypography.h2),
                      ],
                    ),
                    if (!aiState.isSidebarOpen)
                      OutlinedButton(
                        key: const Key("dashboardOpenChatButton"),
                        onPressed: () => ref.read(aiProvider.notifier).setSidebarOpen(true),
                        child: const Text("Open Chat"),
                      ),
                  ],
                ),
                const SizedBox(height: AppSpacing.md),
                Expanded(
                  child: widgets.isEmpty
                      ? Center(
                          child: Padding(
                            padding: const EdgeInsets.all(AppSpacing.xl),
                            child: Text(
                              'No widgets pinned yet. Ask the AI to create a dashboard '
                              'card.\n\nTry asking: "Create a metric for ERROR logs"',
                              textAlign: TextAlign.center,
                              style: AppTypography.body.copyWith(color: AppColors.textMuted),
                            ),
                          ),
                        )
                      : GridView.builder(
                          gridDelegate: const SliverGridDelegateWithMaxCrossAxisExtent(
                            maxCrossAxisExtent: 320,
                            mainAxisExtent: 140,
                            crossAxisSpacing: AppSpacing.md,
                            mainAxisSpacing: AppSpacing.md,
                          ),
                          itemCount: widgets.length,
                          itemBuilder: (context, i) => A2UIRenderer(payload: widgets[i]),
                        ),
                ),
              ],
            ),
          ),
          if (aiState.isSidebarOpen) ...[
            const SizedBox(width: AppSpacing.md),
            const SizedBox(width: 420, child: AIInvestigationSidebar()),
          ],
        ],
      ),
    );
  }
}

// ── Private section widgets (mirrors the React source's module-private
// AIObservationCard / ErrorClustersSection / NoiseClustersSection /
// SourceHeatmap components) ──────────────────────────────────────────────

class _AiObservationCard extends StatelessWidget {
  const _AiObservationCard({required this.insight, required this.onDeepDive});

  final String insight;
  final VoidCallback onDeepDive;

  @override
  Widget build(BuildContext context) {
    return Container(
      width: double.infinity,
      padding: const EdgeInsets.all(AppSpacing.lg),
      decoration: BoxDecoration(
        color: AppColors.primary.withValues(alpha: 0.05),
        border: Border.all(color: AppColors.primary.withValues(alpha: 0.2)),
        borderRadius: BorderRadius.circular(AppRadius.xl),
      ),
      child: Row(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Expanded(
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Row(
                  children: [
                    const Icon(Icons.auto_awesome, size: 14, color: AppColors.primary),
                    const SizedBox(width: AppSpacing.xs),
                    Text(
                      "LATEST AI OBSERVATION",
                      style: AppTypography.labelCaps.copyWith(color: AppColors.primary),
                    ),
                  ],
                ),
                const SizedBox(height: AppSpacing.sm),
                Text(
                  '"$insight"',
                  style: AppTypography.monoBody.copyWith(fontStyle: FontStyle.italic),
                ),
              ],
            ),
          ),
          const SizedBox(width: AppSpacing.md),
          ElevatedButton(onPressed: onDeepDive, child: const Text("DEEP DIVE")),
        ],
      ),
    );
  }
}

class _ClusterSection extends StatelessWidget {
  const _ClusterSection({
    required this.title,
    required this.icon,
    required this.iconColor,
    required this.clusters,
    required this.stats,
    required this.workspaceId,
    required this.isError,
    required this.emptyLabel,
    required this.fetchSamples,
  });

  final String title;
  final IconData icon;
  final Color iconColor;
  final List<DashboardClusterSummary> clusters;
  final DashboardStats? stats;
  final String workspaceId;
  final bool isError;
  final String emptyLabel;
  final Future<List<String>> Function(String clusterId, bool isError) fetchSamples;

  @override
  Widget build(BuildContext context) {
    return Container(
      width: double.infinity,
      padding: const EdgeInsets.all(AppSpacing.md),
      decoration: BoxDecoration(
        color: AppColors.bgSurface.withValues(alpha: 0.5),
        border: Border.all(color: AppColors.border),
        borderRadius: BorderRadius.circular(AppRadius.xl),
      ),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Row(
            children: [
              Icon(icon, size: 16, color: iconColor),
              const SizedBox(width: AppSpacing.xs),
              Text(title, style: AppTypography.labelCaps),
            ],
          ),
          const SizedBox(height: AppSpacing.md),
          if (stats == null)
            for (var i = 0; i < 3; i++)
              Padding(
                padding: const EdgeInsets.only(bottom: AppSpacing.sm),
                child: Container(
                  height: 40,
                  decoration: BoxDecoration(
                    color: AppColors.bgSurfaceBright,
                    borderRadius: BorderRadius.circular(AppRadius.lg),
                  ),
                ),
              )
          else if (clusters.isEmpty)
            Padding(
              padding: const EdgeInsets.symmetric(vertical: AppSpacing.xl),
              child: Center(
                child: Text(
                  emptyLabel,
                  style: AppTypography.log.copyWith(fontSize: 10, color: AppColors.textMuted),
                ),
              ),
            )
          else
            for (var i = 0; i < clusters.length; i++)
              Padding(
                padding: const EdgeInsets.only(bottom: AppSpacing.xs),
                child: ClusterRow(
                  index: i,
                  cluster: Cluster(
                    id: clusters[i].clusterId,
                    template: clusters[i].template,
                    size: clusters[i].count,
                  ),
                  total: stats!.totalLogs,
                  type: isError ? ClusterRowType.error : ClusterRowType.noise,
                  fetchSamples: (clusters[i].clusterId.isEmpty || workspaceId == "all")
                      ? null
                      : () => fetchSamples(clusters[i].clusterId, isError),
                ),
              ),
        ],
      ),
    );
  }
}

class _SourceHeatmapSection extends StatelessWidget {
  const _SourceHeatmapSection({required this.stats});

  final DashboardStats? stats;

  @override
  Widget build(BuildContext context) {
    Widget body;
    if (stats == null) {
      body = Column(
        children: [
          for (var i = 0; i < 2; i++)
            Padding(
              padding: const EdgeInsets.only(bottom: AppSpacing.md),
              child: Container(
                height: 16,
                decoration: BoxDecoration(
                  color: AppColors.bgSurfaceBright,
                  borderRadius: BorderRadius.circular(AppRadius.sm),
                ),
              ),
            ),
        ],
      );
    } else if (stats!.sourceHeatmap.isEmpty) {
      body = Padding(
        padding: const EdgeInsets.symmetric(vertical: AppSpacing.xl),
        child: Center(
          child: Text(
            "INSUFFICIENT SOURCE DATA",
            style: AppTypography.log.copyWith(fontSize: 10, color: AppColors.textMuted),
          ),
        ),
      );
    } else {
      final uniqueSources = <String>[];
      for (final p in stats!.sourceHeatmap) {
        if (!uniqueSources.contains(p.sourceName)) uniqueSources.add(p.sourceName);
      }
      body = Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          for (final name in uniqueSources)
            _HeatmapRow(
              sourceName: name,
              points: stats!.sourceHeatmap.where((p) => p.sourceName == name).toList(),
            ),
        ],
      );
    }

    return Container(
      width: double.infinity,
      padding: const EdgeInsets.all(AppSpacing.md),
      decoration: BoxDecoration(
        color: AppColors.bgSurface.withValues(alpha: 0.5),
        border: Border.all(color: AppColors.border),
        borderRadius: BorderRadius.circular(AppRadius.xl),
      ),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Row(
            children: [
              const Icon(Icons.grid_on, size: 16, color: AppColors.primary),
              const SizedBox(width: AppSpacing.xs),
              Text("SOURCE ACTIVITY HEATMAP", style: AppTypography.labelCaps),
            ],
          ),
          const SizedBox(height: AppSpacing.md),
          body,
        ],
      ),
    );
  }
}

class _HeatmapRow extends StatelessWidget {
  const _HeatmapRow({required this.sourceName, required this.points});

  final String sourceName;
  final List<DashboardSourceHeatmapPoint> points;

  @override
  Widget build(BuildContext context) {
    var maxCount = 0;
    for (final p in points) {
      if (p.count > maxCount) maxCount = p.count;
    }
    final slice = points.length > 50 ? points.sublist(points.length - 50) : points;

    return Padding(
      padding: const EdgeInsets.only(bottom: AppSpacing.sm),
      child: Row(
        crossAxisAlignment: CrossAxisAlignment.center,
        children: [
          SizedBox(
            width: 120,
            child: Text(
              sourceName,
              maxLines: 1,
              overflow: TextOverflow.ellipsis,
              style: AppTypography.log.copyWith(fontSize: 10, color: AppColors.textMuted),
            ),
          ),
          const SizedBox(width: AppSpacing.sm),
          Expanded(
            child: SizedBox(
              height: 16,
              child: Row(
                children: [
                  for (final p in slice)
                    Expanded(
                      child: Tooltip(
                        message: "${p.timestamp}: ${p.count} logs",
                        child: Container(
                          margin: const EdgeInsets.symmetric(horizontal: 1),
                          decoration: BoxDecoration(
                            color: AppColors.primary.withValues(
                              alpha: maxCount > 0 ? (p.count / maxCount).clamp(0.05, 1.0) : 0.05,
                            ),
                            borderRadius: BorderRadius.circular(2),
                          ),
                        ),
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
}
