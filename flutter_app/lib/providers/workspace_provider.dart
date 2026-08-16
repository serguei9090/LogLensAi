/// Port of `src/store/workspaceStore.ts` (`useWorkspaceStore`).
library;

import "package:flutter_riverpod/flutter_riverpod.dart";

import "../models/workspace.dart";
import "../services/sidecar_bridge.dart";
import "sidecar_provider.dart";

class WorkspaceState {
  const WorkspaceState({
    this.workspaces = const [],
    this.activeWorkspaceId = "",
    this.isHierarchyLoading = false,
  });

  final List<Workspace> workspaces;
  final String activeWorkspaceId;
  final bool isHierarchyLoading;

  Workspace? get activeWorkspace {
    for (final w in workspaces) {
      if (w.id == activeWorkspaceId) return w;
    }
    return null;
  }

  /// Active [LogSource] inside the active workspace, or null for aggregate view.
  LogSource? get activeSource {
    final ws = activeWorkspace;
    final activeId = ws?.activeSourceId;
    if (ws == null || activeId == null) return null;
    for (final s in ws.sources) {
      if (s.id == activeId) return s;
    }
    return null;
  }

  WorkspaceState copyWith({
    List<Workspace>? workspaces,
    String? activeWorkspaceId,
    bool? isHierarchyLoading,
  }) {
    return WorkspaceState(
      workspaces: workspaces ?? this.workspaces,
      activeWorkspaceId: activeWorkspaceId ?? this.activeWorkspaceId,
      isHierarchyLoading: isHierarchyLoading ?? this.isHierarchyLoading,
    );
  }
}

class WorkspaceNotifier extends StateNotifier<WorkspaceState> {
  WorkspaceNotifier(this._bridge) : super(const WorkspaceState());

  final SidecarBridge _bridge;

  void setActive(String id) => state = state.copyWith(activeWorkspaceId: id);

  /// `Pick<Workspace, "id" | "name">` in TS -- local-only, no RPC call.
  void addWorkspace({required String id, required String name}) {
    if (state.workspaces.any((w) => w.id == id)) return;
    final newWs = Workspace(
      id: id,
      name: name,
      createdAt: DateTime.now().toIso8601String(),
    );
    state = state.copyWith(
      workspaces: [...state.workspaces, newWs],
      activeWorkspaceId: state.activeWorkspaceId.isEmpty ? id : state.activeWorkspaceId,
    );
  }

  Future<void> removeWorkspace(String id) async {
    try {
      await _bridge.call("delete_workspace", {"workspace_id": id});
    } catch (_) {
      // Mirror TS: log-and-continue, local state is still cleaned up.
    }
    final remaining = state.workspaces.where((w) => w.id != id).toList();
    state = state.copyWith(
      workspaces: remaining,
      activeWorkspaceId: state.activeWorkspaceId == id
          ? (remaining.isNotEmpty ? remaining.first.id : "")
          : state.activeWorkspaceId,
    );
  }

  void renameWorkspace(String id, String name) {
    state = state.copyWith(
      workspaces: [
        for (final w in state.workspaces)
          if (w.id == id) Workspace(
            id: w.id,
            name: name,
            sources: w.sources,
            hierarchy: w.hierarchy,
            activeSourceId: w.activeSourceId,
            activeFolderId: w.activeFolderId,
            createdAt: w.createdAt,
          ) else w,
      ],
    );
  }

  void setActiveSource(String workspaceId, String? sourceId) {
    state = state.copyWith(
      workspaces: [
        for (final w in state.workspaces)
          if (w.id == workspaceId)
            w.copyWith(activeSourceId: sourceId, activeFolderId: null)
          else
            w,
      ],
    );
  }

  void setActiveFolder(String workspaceId, String? folderId) {
    state = state.copyWith(
      workspaces: [
        for (final w in state.workspaces)
          if (w.id == workspaceId)
            w.copyWith(activeFolderId: folderId, activeSourceId: null)
          else
            w,
      ],
    );
  }

  Future<void> fetchHierarchy(String workspaceId) async {
    state = state.copyWith(isHierarchyLoading: true);
    try {
      final res = await _bridge.call<Map<String, dynamic>>(
        "get_hierarchy",
        {"workspace_id": workspaceId},
      );
      final root = HierarchyNode.fromJson(res["root"] as Map<String, dynamic>);
      final flat = root.flattenSources();
      state = state.copyWith(
        workspaces: [
          for (final w in state.workspaces)
            if (w.id == workspaceId)
              w.copyWith(hierarchy: root, sources: flat)
            else
              w,
        ],
      );
    } finally {
      state = state.copyWith(isHierarchyLoading: false);
    }
  }

  Future<LogSource> createSource(
    String workspaceId,
    LogSource sourceWithoutId, {
    String? folderId,
  }) async {
    state = state.copyWith(isHierarchyLoading: true);
    try {
      final res = await _bridge.call<Map<String, dynamic>>("create_log_source", {
        "workspace_id": workspaceId,
        "name": sourceWithoutId.name,
        "type": sourceWithoutId.type,
        "path": sourceWithoutId.path,
        "folder_id": folderId,
      });
      final newSource = sourceWithoutId.copyWith(id: res["source_id"] as String);
      state = state.copyWith(
        workspaces: [
          for (final w in state.workspaces)
            if (w.id == workspaceId)
              w.copyWith(
                sources: [...w.sources, newSource],
                activeSourceId: w.activeSourceId ?? newSource.id,
              )
            else
              w,
        ],
      );
      await fetchHierarchy(workspaceId);
      return newSource;
    } finally {
      state = state.copyWith(isHierarchyLoading: false);
    }
  }

  Future<void> removeSource(String workspaceId, String sourceId) async {
    state = state.copyWith(isHierarchyLoading: true);
    try {
      await _bridge.call("delete_log_source", {"source_id": sourceId});
      state = state.copyWith(
        workspaces: [
          for (final w in state.workspaces)
            if (w.id == workspaceId)
              w.copyWith(
                sources: w.sources.where((s) => s.id != sourceId).toList(),
                activeSourceId: w.activeSourceId == sourceId ? null : w.activeSourceId,
              )
            else
              w,
        ],
      );
      await fetchHierarchy(workspaceId);
    } finally {
      state = state.copyWith(isHierarchyLoading: false);
    }
  }

  Future<void> createFolder(String workspaceId, String name, {String? parentId}) async {
    state = state.copyWith(isHierarchyLoading: true);
    try {
      await _bridge.call("create_folder", {
        "workspace_id": workspaceId,
        "name": name,
        "parent_id": parentId,
      });
      await fetchHierarchy(workspaceId);
    } finally {
      state = state.copyWith(isHierarchyLoading: false);
    }
  }

  Future<void> deleteFolder(String folderId) async {
    state = state.copyWith(isHierarchyLoading: true);
    try {
      await _bridge.call("delete_folder", {"folder_id": folderId});
      if (state.activeWorkspaceId.isNotEmpty) {
        await fetchHierarchy(state.activeWorkspaceId);
      }
    } finally {
      state = state.copyWith(isHierarchyLoading: false);
    }
  }

  Future<void> moveSource(String sourceId, String? folderId) async {
    state = state.copyWith(isHierarchyLoading: true);
    try {
      await _bridge.call("move_source", {"source_id": sourceId, "folder_id": folderId});
      if (state.activeWorkspaceId.isNotEmpty) {
        await fetchHierarchy(state.activeWorkspaceId);
      }
    } finally {
      state = state.copyWith(isHierarchyLoading: false);
    }
  }

  void reset() => state = const WorkspaceState();

  /// Fetches up to [limit] random raw log lines for regex-column preview,
  /// mirroring `AddColumnModal.tsx`'s `get_sample_logs` call
  /// (`{workspace_id, limit, source_id?}` -> `{samples: string[]}`). Used by
  /// [ColumnManagerSidebar]'s "Add Column" flow. Returns `[]` on any RPC
  /// failure rather than throwing, matching the React `.catch(() => [])`.
  Future<List<String>> getSampleLogs(
    String workspaceId, {
    String? sourceId,
    int limit = 10,
  }) async {
    try {
      final res = await _bridge.call<Map<String, dynamic>>("get_sample_logs", {
        "workspace_id": workspaceId,
        "limit": limit,
        if (sourceId != null) "source_id": sourceId,
      });
      return (res["samples"] as List<dynamic>? ?? const [])
          .map((e) => e.toString())
          .toList();
    } catch (_) {
      return const [];
    }
  }

  /// Fetches up to [limit] raw sample lines for a specific source, mirroring
  /// `CustomParserModal.tsx`'s `get_sample_lines` call
  /// (`{workspace_id, source_id, limit}` -> `string[]`). Used by
  /// [CustomParserModal]'s "Raw Source Samples" pane. Returns `[]` on any
  /// RPC failure rather than throwing, matching the React
  /// `.catch(...)`/toast-and-continue behavior.
  Future<List<String>> getSampleLines(
    String workspaceId,
    String sourceId, {
    int limit = 15,
  }) async {
    try {
      final res = await _bridge.call<List<dynamic>>("get_sample_lines", {
        "workspace_id": workspaceId,
        "source_id": sourceId,
        "limit": limit,
      });
      return res.map((e) => e.toString()).toList();
    } catch (_) {
      return const [];
    }
  }

  // ── Source/folder rename (Sidebar / HierarchyTree / WorkspaceTabs) ──
  //
  // Additive methods backing `HierarchyTree.onRenameSource` /
  // `onRenameFolder` and `WorkspaceTabs.onRenameSource`, which the React
  // `Sidebar`/`LogToolbar` organisms wire straight to `callSidecar`. Both
  // hit the Go backend's `update_log_source` / `update_folder` RPCs (see
  // `backend-go/internal/models.SourceUpdateRequest` /
  // `FolderUpdateRequest` -- both take `{source_id|folder_id, name}`).

  Future<void> renameSource(String workspaceId, String sourceId, String name) async {
    try {
      await _bridge.call("update_log_source", {"source_id": sourceId, "name": name});
    } catch (_) {
      // Mirror TS: log-and-continue, local state still reflects the rename.
    }
    state = state.copyWith(
      workspaces: [
        for (final w in state.workspaces)
          if (w.id == workspaceId)
            w.copyWith(
              sources: [
                for (final s in w.sources)
                  if (s.id == sourceId) s.copyWith(name: name) else s,
              ],
            )
          else
            w,
      ],
    );
  }

  Future<void> renameFolder(String folderId, String name) async {
    try {
      await _bridge.call("update_folder", {"folder_id": folderId, "name": name});
    } catch (_) {
      // Mirror TS: log-and-continue.
    }
    if (state.activeWorkspaceId.isNotEmpty) {
      await fetchHierarchy(state.activeWorkspaceId);
    }
  }

  // ── Fusion / temporal-sync (OrchestratorHub) ─────────────────────────
  //
  // Additive methods backing `OrchestratorHub.tsx`'s direct `callSidecar`
  // calls for the "Log Fusion" and "Temporal Sync" flows. Kept on
  // [WorkspaceNotifier] since fusion sources end up as `type: "fusion"`
  // `LogSource`s in the workspace's source list.

  Future<Map<String, dynamic>> getFusionConfig(String workspaceId, String fusionId) {
    return _bridge.call<Map<String, dynamic>>("get_fusion_config", {
      "workspace_id": workspaceId,
      "fusion_id": fusionId,
    });
  }

  Future<void> updateFusionConfig(
    String workspaceId,
    String fusionId,
    List<Map<String, dynamic>> sources,
  ) {
    return _bridge.call("update_fusion_config", {
      "workspace_id": workspaceId,
      "fusion_id": fusionId,
      "sources": sources,
    });
  }

  Future<List<Map<String, dynamic>>> getTemplates(String workspaceId) async {
    final raw = await _bridge.call<List<dynamic>>("get_templates", {"workspace_id": workspaceId});
    return raw.cast<Map<String, dynamic>>();
  }

  Future<Map<String, dynamic>> getTemporalOffsets(String workspaceId) async {
    final res = await _bridge.call<Map<String, dynamic>>("get_temporal_offsets", {
      "workspace_id": workspaceId,
    });
    return (res["offsets"] as Map?)?.cast<String, dynamic>() ?? const {};
  }

  Future<void> updateTemporalOffsets(String workspaceId, Map<String, dynamic> offsets) {
    return _bridge.call("update_temporal_offsets", {
      "workspace_id": workspaceId,
      "offsets": offsets,
    });
  }
}

final workspaceProvider = StateNotifierProvider<WorkspaceNotifier, WorkspaceState>((ref) {
  return WorkspaceNotifier(ref.watch(sidecarBridgeProvider));
});
