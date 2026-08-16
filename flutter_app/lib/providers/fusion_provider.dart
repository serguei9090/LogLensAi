/// RPC gateway for `get_fusion_config` / `update_fusion_config`, backing
/// `widgets/organisms/fusion_config_engine.dart`.
///
/// The React source (`FusionConfigEngine.tsx`) calls `callSidecar` directly
/// from the component with no dedicated Zustand store -- fusion config isn't
/// owned by any of the 9 ported stores either. Rather than bolt this onto an
/// unrelated store (risking merge collisions with the other agents currently
/// editing `workspace_provider.dart`/`ingestion_provider.dart` for their own
/// organisms) or call [SidecarBridge] directly from the widget, this is a
/// small dedicated service provider -- consistent with the project's
/// "provider methods, not raw bridge calls, from widgets" rule while staying
/// a self-contained new file.
library;

import "package:flutter_riverpod/flutter_riverpod.dart";

import "../models/fusion_config.dart";
import "../services/sidecar_bridge.dart";
import "sidecar_provider.dart";

class FusionConfigService {
  FusionConfigService(this._bridge);

  final SidecarBridge _bridge;

  Future<List<FusionSourceConfig>> fetchConfig(String workspaceId) async {
    final res = await _bridge.call<Map<String, dynamic>>("get_fusion_config", {
      "workspace_id": workspaceId,
    });
    final list = res["sources"] as List<dynamic>? ?? const [];
    return list.map((s) => FusionSourceConfig.fromJson(s as Map<String, dynamic>)).toList();
  }

  Future<void> saveConfig(String workspaceId, List<FusionSourceConfig> configs) async {
    await _bridge.call("update_fusion_config", {
      "workspace_id": workspaceId,
      "sources": configs.map((c) => c.toJson()).toList(),
    });
  }
}

final fusionConfigServiceProvider = Provider<FusionConfigService>((ref) {
  return FusionConfigService(ref.watch(sidecarBridgeProvider));
});
