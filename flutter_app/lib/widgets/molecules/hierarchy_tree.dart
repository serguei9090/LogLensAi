/// Dart port of `src/components/molecules/HierarchyTree.tsx`.
///
/// Recursive folder/source explorer tree for the Sidebar: renders a
/// [HierarchyNode]'s child folders (recursing into `HierarchyTree` again)
/// and leaf [LogSource]s, with inline folder create/rename and
/// delete-with-confirmation (via [ConfirmationDialog]).
///
/// Deviations from the React source:
///  - The React version renders each leaf source via the sibling
///    `SourceItem` molecule. That widget is one of the ones concurrently
///    being built by another pass of this migration and may not exist yet
///    in `lib/widgets/molecules/` at any given moment, so depending on it
///    here would be a build-order hazard. This file renders leaf source
///    rows with a small private `_SourceRow` instead, kept deliberately
///    simple (name, active state, rename, delete) -- swap it out for the
///    real `SourceItem` once that lands, if a richer row (type icon, live
///    status, etc.) is wanted.
///  - **Drag-and-drop is a stub.** The React version wraps every row in
///    `DraggableItem`/`DroppableArea` (a dnd-kit wrapper) so sources can be
///    dragged between folders. Wiring real Flutter drag-and-drop
///    (`Draggable`/`DragTarget` or `LongPressDraggable`) is nontrivial
///    layout-wise (needs drag-feedback theming, per-folder drop-target
///    highlighting, and the root drop zone) and out of scope for this
///    pass. [onMoveSource] is plumbed through end-to-end and rows report
///    their would-be drag identity, but nothing currently triggers it --
///    follow-up TODO once the rest of the Sidebar/Investigation page
///    layout exists to design real drag affordances against.
library;

import "package:flutter/material.dart";

import "../../models/workspace.dart";
import "../../theme/app_theme.dart";
import "confirmation_dialog.dart";

class HierarchyTree extends StatefulWidget {
  const HierarchyTree({
    super.key,
    required this.node,
    this.activeSourceId,
    this.activeFolderId,
    this.initiallyExpanded = true,
    required this.onSelectSource,
    required this.onSelectFolder,
    this.onCreateFolder,
    this.onRenameFolder,
    this.onDeleteFolder,
    this.onRenameSource,
    this.onDeleteSource,
    this.onMoveSource,
    this.isSourceIngesting,
  });

  /// Root (or current) node of the subtree to render. Pass the workspace's
  /// root `HierarchyNode` (conventionally `id == "root"`) to render the
  /// whole tree -- the root gets flat (chrome-less) treatment like the
  /// React version, children/sources indent below it.
  final HierarchyNode node;

  final String? activeSourceId;
  final String? activeFolderId;

  /// Only used for non-root folder nodes' own expand/collapse state.
  final bool initiallyExpanded;

  final ValueChanged<LogSource> onSelectSource;
  final ValueChanged<HierarchyNode> onSelectFolder;

  /// `(parentFolderId, name)`. Null disables the "New Folder" affordance.
  final void Function(String parentFolderId, String name)? onCreateFolder;

  /// `(folderId, newName)`.
  final void Function(String folderId, String newName)? onRenameFolder;

  /// `(folderId)`, called only after the confirmation dialog is accepted.
  final ValueChanged<String>? onDeleteFolder;

  /// `(sourceId, newName)`.
  final void Function(String sourceId, String newName)? onRenameSource;

  /// `(sourceId)`, called only after the confirmation dialog is accepted.
  final ValueChanged<String>? onDeleteSource;

  /// Stubbed drag-and-drop hook: `(sourceId, targetFolderId)`. See the file
  /// doc comment -- nothing currently calls this.
  final void Function(String sourceId, String targetFolderId)? onMoveSource;

  /// Lets the caller flag a source as "currently ingesting" so the delete
  /// confirmation can show the stronger in-flight-ingestion warning copy,
  /// mirroring the React version's `jobs.some(...)` check against
  /// `useIngestionStore`.
  final bool Function(String sourceId)? isSourceIngesting;

  static const String rootId = "root";

  @override
  State<HierarchyTree> createState() => _HierarchyTreeState();
}

class _HierarchyTreeState extends State<HierarchyTree> {
  late bool _isExpanded = widget.initiallyExpanded;
  bool _isAddingFolder = false;
  final _newFolderController = TextEditingController();

  String? _renamingFolderId;
  final _renameFolderController = TextEditingController();
  String? _renamingSourceId;
  final _renameSourceController = TextEditingController();

  @override
  void dispose() {
    _newFolderController.dispose();
    _renameFolderController.dispose();
    _renameSourceController.dispose();
    super.dispose();
  }

  bool get _isRoot => widget.node.id == HierarchyTree.rootId;

  Future<void> _confirmDeleteFolder(HierarchyNode node) async {
    await ConfirmationDialog.show(
      context,
      title: "Delete Folder?",
      description:
          'This will permanently delete the folder "${node.name}" and ALL its subfolders '
          "and files. This action cannot be undone.",
      variant: ConfirmationVariant.destructive,
      confirmText: "Delete",
      onConfirm: () => widget.onDeleteFolder?.call(node.id),
    );
  }

  Future<void> _confirmDeleteSource(LogSource source) async {
    final ingesting = widget.isSourceIngesting?.call(source.id) ?? false;
    final description = ingesting
        ? "Warning: This log source is currently importing logs. Deleting it will cancel the "
              "ingestion and wipe all partially written log lines. Are you sure you want to proceed?"
        : 'This will remove "${source.name}" from the workspace. Annotations and parsed data '
              "for this source will be deleted.";
    await ConfirmationDialog.show(
      context,
      title: "Delete Source?",
      description: description,
      variant: ConfirmationVariant.destructive,
      confirmText: "Delete",
      onConfirm: () => widget.onDeleteSource?.call(source.id),
    );
  }

  void _submitNewFolder() {
    final name = _newFolderController.text.trim();
    if (name.isNotEmpty) {
      widget.onCreateFolder?.call(widget.node.id, name);
    }
    setState(() {
      _isAddingFolder = false;
      _newFolderController.clear();
    });
  }

  void _submitRenameFolder(String folderId) {
    final name = _renameFolderController.text.trim();
    if (name.isNotEmpty) {
      widget.onRenameFolder?.call(folderId, name);
    }
    setState(() => _renamingFolderId = null);
  }

  void _submitRenameSource(String sourceId) {
    final name = _renameSourceController.text.trim();
    if (name.isNotEmpty) {
      widget.onRenameSource?.call(sourceId, name);
    }
    setState(() => _renamingSourceId = null);
  }

  @override
  Widget build(BuildContext context) {
    if (_isRoot) {
      return Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        mainAxisSize: MainAxisSize.min,
        children: [
          for (final child in widget.node.children)
            HierarchyTree(
              node: child,
              activeSourceId: widget.activeSourceId,
              activeFolderId: widget.activeFolderId,
              onSelectSource: widget.onSelectSource,
              onSelectFolder: widget.onSelectFolder,
              onCreateFolder: widget.onCreateFolder,
              onRenameFolder: widget.onRenameFolder,
              onDeleteFolder: widget.onDeleteFolder,
              onRenameSource: widget.onRenameSource,
              onDeleteSource: widget.onDeleteSource,
              onMoveSource: widget.onMoveSource,
              isSourceIngesting: widget.isSourceIngesting,
            ),
          for (final source in widget.node.sources) _sourceRow(source),
          _addFolderAffordance(),
        ],
      );
    }

    return Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      mainAxisSize: MainAxisSize.min,
      children: [
        _folderHeader(widget.node),
        if (_isExpanded)
          Padding(
            padding: const EdgeInsets.only(left: AppSpacing.sm),
            child: Container(
              padding: const EdgeInsets.only(left: AppSpacing.xs),
              decoration: const BoxDecoration(
                border: Border(left: BorderSide(color: AppColors.borderSubtle)),
              ),
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                mainAxisSize: MainAxisSize.min,
                children: [
                  for (final child in widget.node.children)
                    HierarchyTree(
                      node: child,
                      activeSourceId: widget.activeSourceId,
                      activeFolderId: widget.activeFolderId,
                      onSelectSource: widget.onSelectSource,
                      onSelectFolder: widget.onSelectFolder,
                      onCreateFolder: widget.onCreateFolder,
                      onRenameFolder: widget.onRenameFolder,
                      onDeleteFolder: widget.onDeleteFolder,
                      onRenameSource: widget.onRenameSource,
                      onDeleteSource: widget.onDeleteSource,
                      onMoveSource: widget.onMoveSource,
                      isSourceIngesting: widget.isSourceIngesting,
                    ),
                  for (final source in widget.node.sources) _sourceRow(source),
                ],
              ),
            ),
          ),
      ],
    );
  }

  Widget _folderHeader(HierarchyNode node) {
    if (_renamingFolderId == node.id) {
      return Padding(
        padding: const EdgeInsets.symmetric(horizontal: AppSpacing.xs, vertical: 4),
        child: TextField(
          controller: _renameFolderController,
          autofocus: true,
          style: AppTypography.body.copyWith(fontSize: 12),
          decoration: const InputDecoration(isDense: true),
          onSubmitted: (_) => _submitRenameFolder(node.id),
          onTapOutside: (_) => _submitRenameFolder(node.id),
        ),
      );
    }

    final isActiveFolder = widget.activeFolderId == node.id;
    return Material(
      color: Colors.transparent,
      child: InkWell(
        onTap: () => widget.onSelectFolder(node),
        borderRadius: BorderRadius.circular(AppRadius.sm),
        child: Padding(
          padding: const EdgeInsets.symmetric(horizontal: AppSpacing.xs, vertical: 4),
          child: Row(
            children: [
              InkWell(
                onTap: () => setState(() => _isExpanded = !_isExpanded),
                borderRadius: BorderRadius.circular(4),
                child: Padding(
                  padding: const EdgeInsets.all(2),
                  child: Icon(
                    _isExpanded ? Icons.expand_more : Icons.chevron_right,
                    size: 14,
                    color: AppColors.textMuted,
                  ),
                ),
              ),
              Icon(
                Icons.folder,
                size: 14,
                color: isActiveFolder ? AppColors.primary : AppColors.primary.withValues(alpha: 0.7),
              ),
              const SizedBox(width: 6),
              Expanded(
                child: Text(
                  node.name,
                  maxLines: 1,
                  overflow: TextOverflow.ellipsis,
                  style: AppTypography.body.copyWith(
                    fontSize: 12,
                    color: isActiveFolder ? AppColors.primary : AppColors.textSecondary,
                    fontWeight: isActiveFolder ? FontWeight.w600 : FontWeight.w400,
                  ),
                ),
              ),
              IconButton(
                iconSize: 12,
                padding: EdgeInsets.zero,
                constraints: const BoxConstraints(minWidth: 24, minHeight: 24),
                onPressed: () => setState(() {
                  _renamingFolderId = node.id;
                  _renameFolderController.text = node.name;
                }),
                icon: const Icon(Icons.edit_outlined),
                color: AppColors.textMuted,
              ),
              IconButton(
                iconSize: 12,
                padding: EdgeInsets.zero,
                constraints: const BoxConstraints(minWidth: 24, minHeight: 24),
                onPressed: () => _confirmDeleteFolder(node),
                icon: const Icon(Icons.delete_outline),
                color: AppColors.error.withValues(alpha: 0.8),
              ),
            ],
          ),
        ),
      ),
    );
  }

  Widget _sourceRow(LogSource source) {
    if (_renamingSourceId == source.id) {
      return Padding(
        padding: const EdgeInsets.symmetric(horizontal: AppSpacing.xs, vertical: 4),
        child: TextField(
          controller: _renameSourceController,
          autofocus: true,
          style: AppTypography.body.copyWith(fontSize: 12),
          decoration: const InputDecoration(isDense: true),
          onSubmitted: (_) => _submitRenameSource(source.id),
          onTapOutside: (_) => _submitRenameSource(source.id),
        ),
      );
    }

    final active = widget.activeSourceId == source.id;
    return Material(
      color: active ? AppColors.primary.withValues(alpha: 0.1) : Colors.transparent,
      borderRadius: BorderRadius.circular(AppRadius.sm),
      child: InkWell(
        onTap: () => widget.onSelectSource(source),
        borderRadius: BorderRadius.circular(AppRadius.sm),
        child: Padding(
          padding: const EdgeInsets.symmetric(horizontal: AppSpacing.xs, vertical: 4),
          child: Row(
            children: [
              const SizedBox(width: 18),
              Icon(
                Icons.description_outlined,
                size: 13,
                color: active ? AppColors.primary : AppColors.textMuted,
              ),
              const SizedBox(width: 6),
              Expanded(
                child: Text(
                  source.name,
                  maxLines: 1,
                  overflow: TextOverflow.ellipsis,
                  style: AppTypography.body.copyWith(
                    fontSize: 12,
                    color: active ? AppColors.primary : AppColors.textSecondary,
                    fontWeight: active ? FontWeight.w600 : FontWeight.w400,
                  ),
                ),
              ),
              IconButton(
                iconSize: 12,
                padding: EdgeInsets.zero,
                constraints: const BoxConstraints(minWidth: 22, minHeight: 22),
                onPressed: () => setState(() {
                  _renamingSourceId = source.id;
                  _renameSourceController.text = source.name;
                }),
                icon: const Icon(Icons.edit_outlined),
                color: AppColors.textMuted,
              ),
              IconButton(
                iconSize: 12,
                padding: EdgeInsets.zero,
                constraints: const BoxConstraints(minWidth: 22, minHeight: 22),
                onPressed: () => _confirmDeleteSource(source),
                icon: const Icon(Icons.delete_outline),
                color: AppColors.error.withValues(alpha: 0.8),
              ),
            ],
          ),
        ),
      ),
    );
  }

  Widget _addFolderAffordance() {
    if (widget.onCreateFolder == null) return const SizedBox.shrink();
    if (_isAddingFolder) {
      return Padding(
        padding: const EdgeInsets.symmetric(horizontal: AppSpacing.xs, vertical: 4),
        child: TextField(
          controller: _newFolderController,
          autofocus: true,
          style: AppTypography.body.copyWith(fontSize: 12),
          decoration: const InputDecoration(isDense: true, hintText: "Folder name"),
          onSubmitted: (_) => _submitNewFolder(),
          onTapOutside: (_) {
            if (_newFolderController.text.trim().isEmpty) {
              setState(() => _isAddingFolder = false);
            }
          },
        ),
      );
    }
    return TextButton.icon(
      onPressed: () => setState(() => _isAddingFolder = true),
      icon: const Icon(Icons.create_new_folder_outlined, size: 14),
      label: const Text("New Folder"),
      style: TextButton.styleFrom(
        foregroundColor: AppColors.textMuted,
        textStyle: const TextStyle(fontSize: 11),
        padding: const EdgeInsets.symmetric(horizontal: AppSpacing.xs, vertical: 4),
        alignment: Alignment.centerLeft,
      ),
    );
  }
}
