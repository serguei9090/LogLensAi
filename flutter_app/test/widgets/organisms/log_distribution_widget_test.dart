import "package:flutter/material.dart";
import "package:flutter_riverpod/flutter_riverpod.dart";
import "package:flutter_test/flutter_test.dart";

import "package:loglensai/models/distribution.dart";
import "package:loglensai/providers/distribution_provider.dart";
import "package:loglensai/providers/investigation_provider.dart";
import "package:loglensai/services/sidecar_bridge.dart";
import "package:loglensai/theme/app_theme.dart";
import "package:loglensai/widgets/organisms/log_distribution_widget.dart";

/// Fake [DistributionService] -- same pattern as `_FakeAiNotifier` in
/// `ai_investigation_sidebar_test.dart`: overrides both RPC-backed methods
/// with in-memory stand-ins so tests never touch a real [SidecarBridge].
class _FakeDistributionService extends DistributionService {
  _FakeDistributionService({
    this.buckets = const [],
    this.bucketInterval = "1 hour",
    this.anomalies = const [],
    this.throwOnFetch = false,
  }) : super(SidecarBridge());

  final List<DistributionBucket> buckets;
  final String bucketInterval;
  final List<LogAnomaly> anomalies;
  final bool throwOnFetch;
  int fetchCount = 0;

  @override
  Future<DistributionResult> fetchDistribution({
    required String workspaceId,
    List<String>? sourceIds,
    String? fusionId,
    String? query,
    List<Map<String, dynamic>>? filters,
    String? startTime,
    String? endTime,
  }) async {
    fetchCount++;
    if (throwOnFetch) throw Exception("boom");
    return DistributionResult(buckets: buckets, bucketInterval: bucketInterval);
  }

  @override
  Future<List<LogAnomaly>> fetchAnomalies(String workspaceId) async {
    if (throwOnFetch) throw Exception("boom");
    return anomalies;
  }
}

ProviderContainer _buildContainer(_FakeDistributionService service) {
  return ProviderContainer(overrides: [distributionServiceProvider.overrideWithValue(service)]);
}

Widget _wrap(ProviderContainer container, Widget child) {
  return UncontrolledProviderScope(
    container: container,
    child: MaterialApp(theme: AppTheme.dark, home: Scaffold(body: child)),
  );
}

void main() {
  final buckets = [
    const DistributionBucket(bucket: "2026-08-16 09:00:00", levelCounts: {"INFO": 10, "ERROR": 2}),
    const DistributionBucket(bucket: "2026-08-16 10:00:00", levelCounts: {"INFO": 5, "WARN": 3}),
  ];

  testWidgets("renders a bar per bucket once loaded", (tester) async {
    final service = _FakeDistributionService(buckets: buckets);
    final container = _buildContainer(service);
    addTearDown(container.dispose);

    await tester.pumpWidget(_wrap(container, const LogDistributionWidget(workspaceId: "ws1")));
    await tester.pumpAndSettle();

    expect(find.byKey(const Key("logDistributionBar_0")), findsOneWidget);
    expect(find.byKey(const Key("logDistributionBar_1")), findsOneWidget);
    expect(find.text("No logs matching criteria in this range"), findsNothing);
  });

  testWidgets("shows an empty-state message when there are no buckets", (tester) async {
    final service = _FakeDistributionService();
    final container = _buildContainer(service);
    addTearDown(container.dispose);

    await tester.pumpWidget(_wrap(container, const LogDistributionWidget(workspaceId: "ws1")));
    await tester.pumpAndSettle();

    expect(find.text("No logs matching criteria in this range"), findsOneWidget);
  });

  testWidgets("shows a live-data hint in the empty state while tailing", (tester) async {
    final service = _FakeDistributionService();
    final container = _buildContainer(service);
    addTearDown(container.dispose);

    await tester.pumpWidget(
      _wrap(container, const LogDistributionWidget(workspaceId: "ws1", isTailing: true)),
    );
    await tester.pump();
    await tester.pump();

    expect(find.text("Waiting for live data..."), findsOneWidget);
  });

  testWidgets("shows an error message when the fetch fails", (tester) async {
    final service = _FakeDistributionService(throwOnFetch: true);
    final container = _buildContainer(service);
    addTearDown(container.dispose);

    await tester.pumpWidget(_wrap(container, const LogDistributionWidget(workspaceId: "ws1")));
    await tester.pumpAndSettle();

    expect(find.text("Failed to load log distribution"), findsOneWidget);
  });

  testWidgets("tapping a bar zooms the investigation time range to that bucket's window", (tester) async {
    final service = _FakeDistributionService(buckets: buckets, bucketInterval: "1 hour");
    final container = _buildContainer(service);
    addTearDown(container.dispose);

    await tester.pumpWidget(_wrap(container, const LogDistributionWidget(workspaceId: "ws1")));
    await tester.pumpAndSettle();

    await tester.tap(find.byKey(const Key("logDistributionBar_0")));
    await tester.pump();

    final range = container.read(investigationProvider).timeRange;
    expect(range.start, "2026-08-16T09:00:00");
    expect(range.end, "2026-08-16T10:00:00");
    expect(range.label, "09:00:00 (Zoomed)");
  });

  testWidgets("shows the spike-detected badge when anomalies are present", (tester) async {
    final service = _FakeDistributionService(
      buckets: buckets,
      anomalies: const [
        LogAnomaly(clusterId: "c1", timestamp: "2026-08-16 09:00:00", zScore: 3.2, currentRate: 10),
      ],
    );
    final container = _buildContainer(service);
    addTearDown(container.dispose);

    await tester.pumpWidget(_wrap(container, const LogDistributionWidget(workspaceId: "ws1")));
    await tester.pumpAndSettle();

    expect(find.byKey(const Key("logDistributionSpikeBadge")), findsOneWidget);
  });

  testWidgets("shows the live-flow badge while tailing", (tester) async {
    final service = _FakeDistributionService(buckets: buckets);
    final container = _buildContainer(service);
    addTearDown(container.dispose);

    await tester.pumpWidget(
      _wrap(container, const LogDistributionWidget(workspaceId: "ws1", isTailing: true)),
    );
    await tester.pump();
    await tester.pump();

    expect(find.byKey(const Key("logDistributionLiveBadge")), findsOneWidget);
  });

  testWidgets("close button invokes onClose", (tester) async {
    final service = _FakeDistributionService(buckets: buckets);
    final container = _buildContainer(service);
    addTearDown(container.dispose);
    var closed = false;

    await tester.pumpWidget(
      _wrap(
        container,
        LogDistributionWidget(workspaceId: "ws1", onClose: () => closed = true),
      ),
    );
    await tester.pumpAndSettle();

    await tester.tap(find.byKey(const Key("logDistributionCloseButton")));
    await tester.pump();

    expect(closed, isTrue);
  });

  testWidgets("no close button is rendered when onClose is omitted", (tester) async {
    final service = _FakeDistributionService(buckets: buckets);
    final container = _buildContainer(service);
    addTearDown(container.dispose);

    await tester.pumpWidget(_wrap(container, const LogDistributionWidget(workspaceId: "ws1")));
    await tester.pumpAndSettle();

    expect(find.byKey(const Key("logDistributionCloseButton")), findsNothing);
  });

  testWidgets("reset-zoom chip appears when filtered and resets the time range to the full bounds", (
    tester,
  ) async {
    final service = _FakeDistributionService(buckets: buckets);
    final container = _buildContainer(service);
    addTearDown(container.dispose);
    container
        .read(investigationProvider.notifier)
        .setTimeRangeBounds(const TimeRange(start: "2026-08-01T00:00:00", end: "2026-08-16T23:59:59"));
    container
        .read(investigationProvider.notifier)
        .setTimeRange(const TimeRange(start: "2026-08-10T00:00:00", end: "2026-08-10T01:00:00"));

    await tester.pumpWidget(_wrap(container, const LogDistributionWidget(workspaceId: "ws1")));
    await tester.pumpAndSettle();

    expect(find.byKey(const Key("logDistributionResetZoomButton")), findsOneWidget);

    await tester.tap(find.byKey(const Key("logDistributionResetZoomButton")));
    await tester.pump();

    final range = container.read(investigationProvider).timeRange;
    expect(range.start, "2026-08-01T00:00:00");
    expect(range.end, "2026-08-16T23:59:59");
    expect(range.label, "All Time");
  });

  testWidgets("no reset-zoom chip when the time range matches the full bounds", (tester) async {
    final service = _FakeDistributionService(buckets: buckets);
    final container = _buildContainer(service);
    addTearDown(container.dispose);

    await tester.pumpWidget(_wrap(container, const LogDistributionWidget(workspaceId: "ws1")));
    await tester.pumpAndSettle();

    expect(find.byKey(const Key("logDistributionResetZoomButton")), findsNothing);
  });
}
