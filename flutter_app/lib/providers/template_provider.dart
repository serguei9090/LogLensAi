/// RPC gateway for `get_templates` / `save_template` / `delete_template`,
/// backing `widgets/organisms/load_template_modal.dart` and
/// `save_template_modal.dart`.
///
/// Same rationale as `fusion_provider.dart`: the React source calls
/// `callSidecar` directly from each modal with no dedicated store, and
/// "templates" isn't part of any of the 9 ported domain stores -- this is a
/// small dedicated service provider rather than a raw bridge call from the
/// widget or a bolt-on to an unrelated shared store file.
library;

import "package:flutter_riverpod/flutter_riverpod.dart";

import "../models/template.dart";
import "../services/sidecar_bridge.dart";
import "sidecar_provider.dart";

class TemplateService {
  TemplateService(this._bridge);

  final SidecarBridge _bridge;

  Future<List<Template>> fetchTemplates(String workspaceId) async {
    final raw = await _bridge.call<List<dynamic>>("get_templates", {
      "workspace_id": workspaceId,
    });
    return raw.map((t) => Template.fromJson(t as Map<String, dynamic>)).toList();
  }

  Future<void> saveTemplate({
    required String workspaceId,
    required String name,
    required String configJson,
  }) async {
    await _bridge.call("save_template", {
      "workspace_id": workspaceId,
      "name": name,
      "config_json": configJson,
    });
  }

  Future<void> deleteTemplate(int id) async {
    await _bridge.call("delete_template", {"id": id});
  }
}

final templateServiceProvider = Provider<TemplateService>((ref) {
  return TemplateService(ref.watch(sidecarBridgeProvider));
});
