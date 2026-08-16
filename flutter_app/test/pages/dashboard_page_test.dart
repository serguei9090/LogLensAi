import "package:flutter/material.dart";
import "package:flutter_riverpod/flutter_riverpod.dart";
import "package:flutter_test/flutter_test.dart";

import "package:loglensai/models/dashboard_stats.dart";
import "package:loglensai/pages/dashboard_page.dart";
import "package:loglensai/providers/ai_provider.dart";
import "package:loglensai/providers/dashboard_provider.dart";
import "package:loglensai/providers/workspace_provider.dart";
import "package:loglensai/services/sidecar_bridge.dart";
import "package:loglensai/theme/app_theme.dart";

/// Fake [DashboardNotifier] that never touches a real [SidecarBridge] --
/// records every `fetchStats` call (so tests can assert the refresh button
/// and filter changes trigger a re-fetch with the right params) and returns
/// a canned [DashboardStats] instead of hitting the network, mirroring how
/// `ai_investigation_sidebar_test.dart`'s `_FakeAiNotifier` fakes the
/// notifier layer directly above a real (never-invoked) [SidecarBridge].
class _FakeDashboardNotifier extends DashboardNotifier {
  _FakeDashboardNotifier({this.statsToReturn}) : super(SidecarBridge());

  DashboardStats? statsToReturn;
  final List<Map<String, dynamic>> fetchCalls = [];
  final List<String> clusterSampleCalls = [];

  @override
  Future<DashboardStats?> fetchStats({
    required String workspaceId,
    String sourceId = "all",
    String? startTime,
    String? endTime,
    List<String> activeWorkspaceIds = const [],
  }) async {
    fetchCalls.add({
      "workspaceId": workspaceId,
      "sourceId": sourceId,
      "startTime": startTime,
      "endTime": endTime,
    });
    state = state.copyWith(stats: statsToReturn, loading: false);
    return statsToReturn;
  }

  @override
  Future<List<String>> fetchClusterSamples({
    required String workspaceId,
    required String clusterId,
    required bool isError,
  }) async {
    clusterSampleCalls.add(clusterId);
    return ["sample line for $clusterId"];
  }
}

/// Fake [AiNotifier] -- only [fetchSessions] is overridden (to a no-op),
/// matching `ai_investigation_sidebar_test.dart`'s fake: switching the
/// dashboard into AI mode mounts [AIInvestigationSidebar], whose `initState`
/// calls `fetchSessions` against a real bridge otherwise.
class _FakeAiNotifier extends AiNotifier {
  _FakeAiNotifier() : super(SidecarBridge());

  @override
  Future<void> fetchSessions(String workspaceId) async {}
}

DashboardStats _sampleStats() {
  return const DashboardStats(
    totalLogs: 542,
    totalClusters: 12,
    levelCounts: {"DEBUG": 100, "INFO": 350, "WARN": 62, "ERROR": 30},
    topClusters: [
      DashboardClusterSummary(template: "Connection reset by peer", count: 40, clusterId: "c-noise-1"),
    ],
    topErrorClusters: [
      DashboardClusterSummary(template: "NullPointerException at <*>", count: 18, clusterId: "c-err-1"),
    ],
    timeSeries: [
      DashboardTimeSeriesPoint(
        timestamp: "2026-08-16 08:00",
        rawLevelCounts: {"DEBUG": 10, "INFO": 40, "WARN": 5, "ERROR": 3},
      ),
      DashboardTimeSeriesPoint(
        timestamp: "2026-08-16 09:00",
        rawLevelCounts: {"DEBUG": 12, "INFO": 55, "WARN": 8, "ERROR": 6},
      ),
    ],
    sourceHeatmap: [
      DashboardSourceHeatmapPoint(timestamp: "2026-08-16 08:00", sourceId: "s1", sourceName: "auth.log", count: 5),
      DashboardSourceHeatmapPoint(timestamp: "2026-08-16 09:00", sourceId: "s1", sourceName: "auth.log", count: 9),
    ],
    latestInsight: "Spike in ERROR rate detected around 09:00.",
    newPatternsCount: 3,
    workspaceCount: 1,
    activeTailers: 2,
    bucketInterval: "1 hour",
    timeBounds: DashboardTimeBounds(min: "2026-08-16 08:00", max: "2026-08-16 09:00"),
  );
}

ProviderContainer _buildContainer({DashboardStats? stats, _FakeDashboardNotifier? notifier}) {
  final fakeDashboard = notifier ?? _FakeDashboardNotifier(statsToReturn: stats ?? _sampleStats());
  return ProviderContainer(
    overrides: [
      dashboardProvider.overrideWith((ref) => fakeDashboard),
      aiProvider.overrideWith((ref) => _FakeAiNotifier()),
      // Pure-local methods only (addWorkspace never touches the bridge), so
      // a real SidecarBridge is safe to construct here -- it's simply never
      // called, matching `ai_investigation_sidebar_test.dart`'s convention.
      workspaceProvider.overrideWith(
        (ref) => WorkspaceNotifier(SidecarBridge())..addWorkspace(id: "ws1", name: "Primary Workspace"),
      ),
    ],
  );
}

Widget _wrap(ProviderContainer container) {
  return UncontrolledProviderScope(
    container: container,
    child: MaterialApp(theme: AppTheme.dark, home: const DashboardPage()),
  );
}

void main() {
  setUp(() {
    final binding = TestWidgetsFlutterBinding.ensureInitialized();
    binding.platformDispatcher.views.first.physicalSize = const Size(1400, 2200);
    binding.platformDispatcher.views.first.devicePixelRatio = 1.0;
  });
  tearDown(() {
    final binding = TestWidgetsFlutterBinding.ensureInitialized();
    binding.platformDispatcher.views.first.resetPhysicalSize();
    binding.platformDispatcher.views.first.resetDevicePixelRatio();
  });

  testWidgets("renders header, filters, stat cards, charts, clusters and heatmap in static mode", (
    tester,
  ) async {
    final container = _buildContainer();
    addTearDown(container.dispose);

    await tester.pumpWidget(_wrap(container));
    await tester.pumpAndSettle();

    // Header
    expect(find.text("Dashboard"), findsOneWidget);
    expect(find.byKey(const Key("dashboardRefreshButton")), findsOneWidget);

    // Filters
    expect(find.byKey(const Key("dashboardWorkspaceDropdown")), findsOneWidget);
    expect(find.byKey(const Key("dashboardSourceDropdown")), findsOneWidget);

    // Stat cards (all 5 KPI labels from the React source -- StatCard
    // upper-cases its `label` prop internally, see stat_card.dart).
    expect(find.text("TOTAL INDEX"), findsOneWidget);
    expect(find.text("PATTERNS"), findsOneWidget);
    expect(find.text("LIVE STREAMS"), findsOneWidget);
    expect(find.text("CATALOGS"), findsOneWidget);
    expect(find.text("DRIFT"), findsOneWidget);
    expect(find.text("542"), findsOneWidget);

    // AI observation card (rendered because statsToReturn.latestInsight is set)
    expect(find.text("LATEST AI OBSERVATION"), findsOneWidget);

    // DashboardCharts organism
    expect(find.text("SEVERITY OVER TIME"), findsOneWidget);

    // Cluster sections
    expect(find.text("TOP ERROR CLUSTERS"), findsOneWidget);
    expect(find.text("TOP NOISE GENERATORS"), findsOneWidget);
    expect(find.text("NullPointerException at <*>"), findsOneWidget);
    expect(find.text("Connection reset by peer"), findsOneWidget);

    // Source heatmap
    expect(find.text("SOURCE ACTIVITY HEATMAP"), findsOneWidget);
    expect(find.text("auth.log"), findsOneWidget);

    // Mode toggle
    expect(find.text("Static"), findsOneWidget);
    expect(find.text("AI Insights"), findsOneWidget);
  });

  testWidgets("fetches stats on mount and again when the refresh button is tapped", (tester) async {
    final fake = _FakeDashboardNotifier(statsToReturn: _sampleStats());
    final container = _buildContainer(notifier: fake);
    addTearDown(container.dispose);

    await tester.pumpWidget(_wrap(container));
    await tester.pumpAndSettle();

    expect(fake.fetchCalls.length, 1);
    expect(fake.fetchCalls.first["workspaceId"], "ws1");

    await tester.tap(find.byKey(const Key("dashboardRefreshButton")));
    await tester.pumpAndSettle();

    expect(fake.fetchCalls.length, 2);
  });

  testWidgets("changing the workspace dropdown resets the source filter and re-fetches", (tester) async {
    final fake = _FakeDashboardNotifier(statsToReturn: _sampleStats());
    final container = ProviderContainer(
      overrides: [
        dashboardProvider.overrideWith((ref) => fake),
        aiProvider.overrideWith((ref) => _FakeAiNotifier()),
        workspaceProvider.overrideWith(
          (ref) => WorkspaceNotifier(SidecarBridge())
            ..addWorkspace(id: "ws1", name: "Primary Workspace")
            ..addWorkspace(id: "ws2", name: "Secondary Workspace"),
        ),
      ],
    );
    addTearDown(container.dispose);

    await tester.pumpWidget(_wrap(container));
    await tester.pumpAndSettle();
    final callsBeforeChange = fake.fetchCalls.length;

    await tester.tap(find.byKey(const Key("dashboardWorkspaceDropdown")));
    await tester.pumpAndSettle();
    await tester.tap(find.text("Secondary Workspace").last);
    await tester.pumpAndSettle();

    expect(fake.fetchCalls.length, greaterThan(callsBeforeChange));
    expect(fake.fetchCalls.last["workspaceId"], "ws2");
    expect(fake.fetchCalls.last["sourceId"], "all");
  });

  testWidgets("mode toggle switches the page between Static and AI Insights display", (tester) async {
    final container = _buildContainer();
    addTearDown(container.dispose);

    await tester.pumpWidget(_wrap(container));
    await tester.pumpAndSettle();

    // Static mode: header says "Dashboard", no AI canvas.
    expect(find.text("Dashboard"), findsOneWidget);
    expect(find.text("AI DASHBOARD CANVAS"), findsNothing);

    await tester.tap(find.text("AI Insights"));
    await tester.pumpAndSettle();

    // AI mode: header title flips to "AI Insights", canvas renders, static
    // sections are gone.
    expect(find.text("AI DASHBOARD CANVAS"), findsOneWidget);
    expect(find.text("TOP ERROR CLUSTERS"), findsNothing);

    await tester.tap(find.text("Static").first);
    await tester.pumpAndSettle();

    expect(find.text("AI DASHBOARD CANVAS"), findsNothing);
    expect(find.text("TOP ERROR CLUSTERS"), findsOneWidget);
  });

  testWidgets("renders loading skeleton state when stats is null", (tester) async {
    final fake = _FakeDashboardNotifier(statsToReturn: null);
    final container = _buildContainer(notifier: fake);
    addTearDown(container.dispose);

    await tester.pumpWidget(_wrap(container));
    // Not pumpAndSettle: AppChartContainer's loading state (stats == null
    // drives DashboardCharts' `loading` prop) runs a repeating shimmer
    // animation that never settles -- same reason
    // `dashboard_charts_test.dart`'s null-stats case uses a plain `pump()`.
    // A couple of frames is enough for the post-frame-callback initial
    // fetch (our fake resolves synchronously) to land.
    await tester.pump();
    await tester.pump(const Duration(milliseconds: 50));

    // StatCard loading state still shows the label (upper-cased internally)
    // even while its value is a skeleton box.
    expect(find.text("TOTAL INDEX"), findsOneWidget);
    expect(find.text("NO ERRORS DETECTED"), findsNothing); // stats == null -> skeleton, not empty-state text
    expect(find.text("LATEST AI OBSERVATION"), findsNothing);
  });
}
