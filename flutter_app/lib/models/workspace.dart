/// Mirrors `src/store/workspaceStore.ts`'s domain types: `LogSource`,
/// `Folder`, `HierarchyNode`, `Workspace`.
library;

/// A single ingestion source attached to a workspace (local file, SSH path,
/// manual paste, or fusion orchestration).
class LogSource {
  const LogSource({
    required this.id,
    required this.name,
    required this.type,
    required this.path,
  });

  /// Unique stable ID for this source within the workspace.
  final String id;

  /// Human-readable display label (defaults to basename of path).
  final String name;

  /// Transport type: 'local' | 'ssh' | 'manual' | 'fusion' | 'live'.
  final String type;

  /// Absolute file path, SSH connection string, or fusion ID for type='fusion'.
  final String path;

  factory LogSource.fromJson(Map<String, dynamic> json) => LogSource(
    id: json["id"]?.toString() ?? "",
    name: json["name"] as String? ?? "",
    type: json["type"] as String? ?? "local",
    path: json["path"] as String? ?? "",
  );

  Map<String, dynamic> toJson() => {
    "id": id,
    "name": name,
    "type": type,
    "path": path,
  };

  LogSource copyWith({String? id, String? name, String? type, String? path}) {
    return LogSource(
      id: id ?? this.id,
      name: name ?? this.name,
      type: type ?? this.type,
      path: path ?? this.path,
    );
  }
}

class Folder {
  const Folder({required this.id, required this.name, required this.parentId});

  final String id;
  final String name;
  final String? parentId;

  factory Folder.fromJson(Map<String, dynamic> json) => Folder(
    id: json["id"]?.toString() ?? "",
    name: json["name"] as String? ?? "",
    parentId: json["parent_id"]?.toString(),
  );
}

class HierarchyNode {
  const HierarchyNode({
    required this.id,
    required this.name,
    this.type = "folder",
    this.children = const [],
    this.sources = const [],
  });

  final String id;
  final String name;
  final String type;
  final List<HierarchyNode> children;
  final List<LogSource> sources;

  factory HierarchyNode.fromJson(Map<String, dynamic> json) => HierarchyNode(
    id: json["id"]?.toString() ?? "",
    name: json["name"] as String? ?? "",
    type: json["type"] as String? ?? "folder",
    children: (json["children"] as List<dynamic>? ?? [])
        .map((c) => HierarchyNode.fromJson(c as Map<String, dynamic>))
        .toList(),
    sources: (json["sources"] as List<dynamic>? ?? [])
        .map((s) => LogSource.fromJson(s as Map<String, dynamic>))
        .toList(),
  );

  /// Flattens this node and all descendants' sources into a single list,
  /// mirroring `workspaceStore.ts`'s `flattenSources`.
  List<LogSource> flattenSources() {
    final list = <LogSource>[...sources];
    for (final child in children) {
      list.addAll(child.flattenSources());
    }
    return list;
  }
}

/// A workspace is a named investigation session with one or more log sources.
class Workspace {
  const Workspace({
    required this.id,
    required this.name,
    this.sources = const [],
    this.hierarchy,
    this.activeSourceId,
    this.activeFolderId,
    required this.createdAt,
  });

  final String id;
  final String name;

  /// Flattened list of sources for active selection and tab-like behavior.
  final List<LogSource> sources;

  /// Tree-based hierarchy for the explorer sidebar.
  final HierarchyNode? hierarchy;

  /// ID of the currently-visible source tab; null -> show all logs (aggregate view).
  final String? activeSourceId;

  /// ID of the currently-selected folder for explorer view; null -> workspace root.
  final String? activeFolderId;

  /// ISO string for safe serialization.
  final String createdAt;

  Workspace copyWith({
    String? id,
    String? name,
    List<LogSource>? sources,
    HierarchyNode? hierarchy,
    Object? activeSourceId = _unset,
    Object? activeFolderId = _unset,
    String? createdAt,
  }) {
    return Workspace(
      id: id ?? this.id,
      name: name ?? this.name,
      sources: sources ?? this.sources,
      hierarchy: hierarchy ?? this.hierarchy,
      activeSourceId: identical(activeSourceId, _unset)
          ? this.activeSourceId
          : activeSourceId as String?,
      activeFolderId: identical(activeFolderId, _unset)
          ? this.activeFolderId
          : activeFolderId as String?,
      createdAt: createdAt ?? this.createdAt,
    );
  }
}

const Object _unset = Object();
