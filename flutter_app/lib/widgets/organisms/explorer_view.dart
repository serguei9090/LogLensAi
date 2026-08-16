/// Dart port of `src/components/organisms/ExplorerView.tsx`.
///
/// Folder/source grid browser shown when no source is active in the
/// Investigation page: a responsive card grid of subfolders and log
/// sources, with inline rename and delete-with-confirmation.
///
/// Deviation from the React source: the React version renders its own
/// bespoke grid tiles (icon + name + item-count/type badge + overflow
/// menu) rather than delegating to `HierarchyTree`/`SourceItem` -- those
/// are compact *list rows* built for the sidebar tree, structurally
/// unsuited to this view's large square grid cards. This port follows the
/// same approach for the same reason (shoehorning a list-row molecule into
/// a grid card would mean fighting its layout, not reusing it), but does
/// reuse [ConfirmationDialog] for the delete flow, exactly like the React
/// source reuses its `ConfirmationDialog` molecule.
///
/// Drag-and-drop (`DraggableItem`/`DroppableArea` in the React source, for
/// dragging a source card onto a folder card to move it) is not ported --
/// same rationale as `HierarchyTree`'s stubbed drag-and-drop: real Flutter
/// DnD affordances are nontrivial layout-wise and out of scope for this
/// organism pass.
library;

import "package:flutter/material.dart";

import "../../models/workspace.dart";
import "../../theme/app_theme.dart";
import "../molecules/confirmation_dialog.dart";

class ExplorerView extends StatefulWidget {
  const ExplorerView({
    super.key,
    required this.folderId,
    this.hierarchy,
    required this.onSelectFolder,
    required this.onSelectSource,
    this.onCreateFolder,
    this.onImportOpen,
    this.workspaceName,
    this.onRenameFolder,
    this.onDeleteFolder,
    this.onRenameSource,
    this.onDeleteSource,
  });

  final String? folderId;
  final HierarchyNode? hierarchy;
  final ValueChanged<String> onSelectFolder;
  final ValueChanged<String> onSelectSource;

  /// `(name)`.
  final ValueChanged<String>? onCreateFolder;
  final VoidCallback? onImportOpen;
  final String? workspaceName;

  /// `(folderId, newName)`.
  final void Function(String, String)? onRenameFolder;
  final ValueChanged<String>? onDeleteFolder;

  /// `(sourceId, newName)`.
  final void Function(String, String)? onRenameSource;
  final ValueChanged<String>? onDeleteSource;

  @override
  State<ExplorerView> createState() => _ExplorerViewState();
}

class _DeleteTarget {
  const _DeleteTarget({required this.id, required this.isFolder, required this.name});
  final String id;
  final bool isFolder;
  final String name;
}

class _ExplorerViewState extends State<ExplorerView> {
  String? _renamingFolderId;
  String? _renamingSourceId;
  final _renameController = TextEditingController();

  @override
  void dispose() {
    _renameController.dispose();
    super.dispose();
  }

  HierarchyNode? _findFolder(HierarchyNode node, String id) {
    if (node.id == id) return node;
    for (final child in node.children) {
      final found = _findFolder(child, id);
      if (found != null) return found;
    }
    return null;
  }

  Future<void> _requestDelete(_DeleteTarget target) {
    return ConfirmationDialog.show(
      context,
      title: target.isFolder ? "Delete Folder?" : "Delete Source?",
      description: target.isFolder
          ? 'This will permanently delete the folder "${target.name}" and ALL its '
                "subfolders and files. This action cannot be undone."
          : 'This will remove "${target.name}" from the workspace. Annotations and '
                "parsed data for this source will be deleted.",
      variant: ConfirmationVariant.destructive,
      confirmText: "Delete",
      onConfirm: () {
        if (target.isFolder) {
          widget.onDeleteFolder?.call(target.id);
        } else {
          widget.onDeleteSource?.call(target.id);
        }
      },
    );
  }

  int _columnsFor(double width) {
    if (width >= 1280) return 4;
    if (width >= 1024) return 3;
    if (width >= 640) return 2;
    return 1;
  }

  @override
  Widget build(BuildContext context) {
    final hierarchy = widget.hierarchy;
    final folderId = widget.folderId;
    final currentFolder = hierarchy == null
        ? null
        : (folderId == null ? hierarchy : _findFolder(hierarchy, folderId));

    if (currentFolder == null) {
      return const Center(
        child: Column(
          mainAxisAlignment: MainAxisAlignment.center,
          children: [
            Icon(Icons.folder_outlined, size: 48, color: AppColors.textMuted),
            SizedBox(height: AppSpacing.md),
            Text("Folder not found", style: TextStyle(color: AppColors.textMuted)),
          ],
        ),
      );
    }

    final title = folderId != null ? currentFolder.name : (widget.workspaceName ?? "Workspace");
    final isEmpty = currentFolder.children.isEmpty && currentFolder.sources.isEmpty;

    return Padding(
      padding: const EdgeInsets.all(AppSpacing.lg),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Row(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              Expanded(
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    Text(
                      title,
                      style: AppTypography.h1.copyWith(fontSize: 24, fontWeight: FontWeight.w900),
                    ),
                    const SizedBox(height: 4),
                    Text(
                      "${currentFolder.children.length} folders, "
                      "${currentFolder.sources.length} sources",
                      style: AppTypography.body.copyWith(
                        fontSize: 12,
                        color: AppColors.textMuted.withValues(alpha: 0.6),
                      ),
                    ),
                  ],
                ),
              ),
              OutlinedButton.icon(
                onPressed: () => widget.onCreateFolder?.call("New Folder"),
                icon: const Icon(Icons.add, size: 16),
                label: const Text("New Folder"),
                style: OutlinedButton.styleFrom(
                  foregroundColor: AppColors.primary,
                  side: BorderSide(color: AppColors.primary.withValues(alpha: 0.2)),
                  shape: const StadiumBorder(),
                ),
              ),
              const SizedBox(width: AppSpacing.sm),
              ElevatedButton.icon(
                onPressed: widget.onImportOpen,
                icon: const Icon(Icons.add, size: 16),
                label: const Text("Import Log"),
                style: ElevatedButton.styleFrom(shape: const StadiumBorder()),
              ),
            ],
          ),
          const SizedBox(height: AppSpacing.lg),
          Expanded(
            child: isEmpty
                ? _emptyState()
                : LayoutBuilder(
                    builder: (context, constraints) {
                      final columns = _columnsFor(constraints.maxWidth);
                      final tiles = [
                        for (final child in currentFolder.children) _folderCard(child),
                        for (final source in currentFolder.sources) _sourceCard(source),
                      ];
                      return GridView.builder(
                        gridDelegate: SliverGridDelegateWithFixedCrossAxisCount(
                          crossAxisCount: columns,
                          crossAxisSpacing: AppSpacing.md,
                          mainAxisSpacing: AppSpacing.md,
                          childAspectRatio: 1.3,
                        ),
                        itemCount: tiles.length,
                        itemBuilder: (context, i) => tiles[i],
                      );
                    },
                  ),
          ),
        ],
      ),
    );
  }

  Widget _emptyState() {
    return Container(
      decoration: BoxDecoration(
        border: Border.all(color: AppColors.borderSubtle, width: 2),
        borderRadius: BorderRadius.circular(AppRadius.xl * 3),
      ),
      child: const Center(
        child: Column(
          mainAxisAlignment: MainAxisAlignment.center,
          children: [
            Icon(Icons.folder_outlined, size: 56, color: AppColors.textMuted),
            SizedBox(height: AppSpacing.md),
            Text(
              "This folder is empty",
              style: TextStyle(color: AppColors.textMuted, fontWeight: FontWeight.w500),
            ),
          ],
        ),
      ),
    );
  }

  Widget _folderCard(HierarchyNode child) {
    final isRenaming = _renamingFolderId == child.id;
    return _ExplorerCard(
      icon: Icons.folder,
      iconBg: AppColors.primary.withValues(alpha: 0.1),
      iconColor: AppColors.primary,
      isRenaming: isRenaming,
      renameController: _renameController,
      name: child.name,
      subtitle: "${child.children.length + child.sources.length} items",
      onTap: () => widget.onSelectFolder(child.id),
      onSubmitRename: () => _submitFolderRename(child),
      onCancelRename: () => setState(() => _renamingFolderId = null),
      menuEnabled: widget.onRenameFolder != null || widget.onDeleteFolder != null,
      onRename: widget.onRenameFolder == null
          ? null
          : () => setState(() {
              _renamingFolderId = child.id;
              _renameController.text = child.name;
            }),
      onDelete: widget.onDeleteFolder == null
          ? null
          : () => _requestDelete(_DeleteTarget(id: child.id, isFolder: true, name: child.name)),
    );
  }

  Widget _sourceCard(LogSource source) {
    final isRenaming = _renamingSourceId == source.id;
    return _ExplorerCard(
      icon: Icons.description_outlined,
      iconBg: AppColors.textMuted.withValues(alpha: 0.1),
      iconColor: AppColors.textMuted,
      isRenaming: isRenaming,
      renameController: _renameController,
      name: source.name,
      subtitle: "${source.type} Source",
      onTap: () => widget.onSelectSource(source.id),
      onSubmitRename: () => _submitSourceRename(source),
      onCancelRename: () => setState(() => _renamingSourceId = null),
      menuEnabled: widget.onRenameSource != null || widget.onDeleteSource != null,
      onRename: widget.onRenameSource == null
          ? null
          : () => setState(() {
              _renamingSourceId = source.id;
              _renameController.text = source.name;
            }),
      onDelete: widget.onDeleteSource == null
          ? null
          : () =>
                _requestDelete(_DeleteTarget(id: source.id, isFolder: false, name: source.name)),
    );
  }

  void _submitFolderRename(HierarchyNode node) {
    final name = _renameController.text.trim();
    if (name.isNotEmpty && name != node.name) {
      widget.onRenameFolder?.call(node.id, name);
    }
    setState(() => _renamingFolderId = null);
  }

  void _submitSourceRename(LogSource source) {
    final name = _renameController.text.trim();
    if (name.isNotEmpty && name != source.name) {
      widget.onRenameSource?.call(source.id, name);
    }
    setState(() => _renamingSourceId = null);
  }
}

class _ExplorerCard extends StatelessWidget {
  const _ExplorerCard({
    required this.icon,
    required this.iconBg,
    required this.iconColor,
    required this.isRenaming,
    required this.renameController,
    required this.name,
    required this.subtitle,
    required this.onTap,
    required this.onSubmitRename,
    required this.onCancelRename,
    required this.menuEnabled,
    required this.onRename,
    required this.onDelete,
  });

  final IconData icon;
  final Color iconBg;
  final Color iconColor;
  final bool isRenaming;
  final TextEditingController renameController;
  final String name;
  final String subtitle;
  final VoidCallback onTap;
  final VoidCallback onSubmitRename;
  final VoidCallback onCancelRename;
  final bool menuEnabled;
  final VoidCallback? onRename;
  final VoidCallback? onDelete;

  @override
  Widget build(BuildContext context) {
    return Stack(
      children: [
        Material(
          color: AppColors.bgSurfaceBright.withValues(alpha: 0.4),
          borderRadius: BorderRadius.circular(AppRadius.xl + 8),
          child: InkWell(
            borderRadius: BorderRadius.circular(AppRadius.xl + 8),
            onTap: isRenaming ? null : onTap,
            child: Container(
              decoration: BoxDecoration(
                border: Border.all(color: AppColors.borderSubtle),
                borderRadius: BorderRadius.circular(AppRadius.xl + 8),
              ),
              padding: const EdgeInsets.all(AppSpacing.md),
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  Container(
                    padding: const EdgeInsets.all(AppSpacing.sm + 4),
                    decoration: BoxDecoration(
                      color: iconBg,
                      borderRadius: BorderRadius.circular(AppRadius.lg),
                    ),
                    child: Icon(icon, size: 22, color: iconColor),
                  ),
                  const SizedBox(height: AppSpacing.sm + 4),
                  if (isRenaming)
                    TextField(
                      controller: renameController,
                      autofocus: true,
                      style: AppTypography.body.copyWith(fontSize: 13),
                      decoration: const InputDecoration(isDense: true),
                      onSubmitted: (_) => onSubmitRename(),
                      onTapOutside: (_) => onSubmitRename(),
                    )
                  else ...[
                    Text(
                      name,
                      maxLines: 1,
                      overflow: TextOverflow.ellipsis,
                      style: AppTypography.body.copyWith(fontWeight: FontWeight.w700),
                    ),
                    const SizedBox(height: 2),
                    Text(
                      subtitle,
                      style: AppTypography.labelCaps.copyWith(
                        fontSize: 9,
                        color: AppColors.textMuted.withValues(alpha: 0.4),
                      ),
                    ),
                  ],
                ],
              ),
            ),
          ),
        ),
        if (menuEnabled && !isRenaming)
          Positioned(
            top: AppSpacing.sm,
            right: AppSpacing.sm,
            child: PopupMenuButton<String>(
              icon: const Icon(Icons.more_vert, size: 16, color: AppColors.textMuted),
              color: AppColors.bgSurface,
              onSelected: (value) {
                if (value == "rename") onRename?.call();
                if (value == "delete") onDelete?.call();
              },
              itemBuilder: (context) => [
                if (onRename != null)
                  const PopupMenuItem(value: "rename", child: Text("Rename")),
                if (onDelete != null)
                  PopupMenuItem(
                    value: "delete",
                    child: Text("Delete", style: TextStyle(color: AppColors.error)),
                  ),
              ],
            ),
          ),
      ],
    );
  }
}
