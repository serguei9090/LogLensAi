/// RPC gateway for `get_log_distribution` / `get_anomalies`, backing
/// `widgets/organisms/log_distribution_widget.dart`.
///
/// Same rationale as `fusion_provider.dart`/`template_provider.dart`: the
/// React source calls `callSidecar` directly from the component with no
/// dedicated store.
library;

import "package:flutter_riverpod/flutter_riverpod.dart";

import "../models/distribution.dart";
import "../services/sidecar_bridge.dart";
import "sidecar_provider.dart";

class DistributionResult {
  const DistributionResult({required this.buckets, required this.bucketInterval});
  final List<DistributionBucket> buckets;
  final String bucketInterval;
}

class DistributionService {
  DistributionService(this._bridge);

  final SidecarBridge _bridge;

  Future<DistributionResult> fetchDistribution({
    required String workspaceId,
    List<String>? sourceIds,
    String? fusionId,
    String? query,
    List<Map<String, dynamic>>? filters,
    String? startTime,
    String? endTime,
  }) async {
    final res = await _bridge.call<Map<String, dynamic>>("get_log_distribution", {
      "workspace_id": workspaceId,
      "source_ids": sourceIds,
      "fusion_id": fusionId,
      "query": query,
      "filters": filters,
      "start_time": startTime,
      "end_time": endTime,
    });
    final buckets = (res["buckets"] as List<dynamic>? ?? const [])
        .map((b) => DistributionBucket.fromJson(b as Map<String, dynamic>))
        .toList();
    return DistributionResult(
      buckets: buckets,
      bucketInterval: res["bucket_interval"] as String? ?? "1 hour",
    );
  }

  Future<List<LogAnomaly>> fetchAnomalies(String workspaceId) async {
    final res = await _bridge.call<Map<String, dynamic>>("get_anomalies", {
      "workspace_id": workspaceId,
    });
    final list = res["anomalies"] as List<dynamic>? ?? const [];
    return list.map((a) => LogAnomaly.fromJson(a as Map<String, dynamic>)).toList();
  }
}

final distributionServiceProvider = Provider<DistributionService>((ref) {
  return DistributionService(ref.watch(sidecarBridgeProvider));
});
