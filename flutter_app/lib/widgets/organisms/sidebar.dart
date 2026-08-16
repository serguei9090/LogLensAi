/// Dart port of `src/components/organisms/Sidebar.tsx`.
///
/// Main left navigation rail: animated width (240px expanded / 60px
/// collapsed), a 64px logo header, a "Workspaces" section with inline
/// add/rename/delete and a per-workspace [HierarchyTree], and a footer nav
/// (Dashboard / Settings / collapse toggle) built from [SidebarNavItem].
///
/// Deviations from the React source:
///  - The React version receives `workspaces`/`activeWorkspaceId`/
///    `onWorkspaceSelect`/`onWorkspaceCreate`/`onWorkspaceRename`/
///    `onWorkspaceDelete` as props from `App.tsx`, which just forwards
///    `useWorkspaceStore()` straight through. Per this migration batch's
///    brief ("wire through the appropriate Riverpod provider's existing
///    methods"), this port reads [workspaceProvider] and [uiProvider]
///    directly instead of threading nine props down from the app shell --
///    the public API only keeps the two props ([activeNav]/[onNavSelect])
///    that don't already live in a provider.
///  - Workspace IDs are still client-generated (`ws-<epoch millis>`),
///    matching `App.tsx`'s `onWorkspaceCreate={(name) => addWorkspace({id:
///    \`ws-${Date.now()}\`, name})}` -- [addWorkspace] itself is local-only
///    (no backend concept of a "workspace" beyond a scoping id).
///  - `HierarchyTree.onRenameSource`/`onRenameFolder` are wired to the new
///    [WorkspaceNotifier.renameSource]/[renameFolder] additive methods (see
///    `lib/providers/workspace_provider.dart`) since the React store had no
///    prior equivalent for either.
library;

import "package:flutter/material.dart";
import "package:flutter_riverpod/flutter_riverpod.dart";

import "../../app.dart";
import "../../models/workspace.dart";
import "../../providers/ui_provider.dart";
import "../../providers/workspace_provider.dart";
import "../../theme/app_theme.dart";
import "../atoms/sidebar_nav_item.dart";
import "../molecules/confirmation_dialog.dart";
import "../molecules/hierarchy_tree.dart";

class Sidebar extends ConsumerStatefulWidget {
  const Sidebar({super.key, required this.activeNav, required this.onNavSelect});

  final NavTab activeNav;
  final ValueChanged<NavTab> onNavSelect;

  @override
  ConsumerState<Sidebar> createState() => _SidebarState();
}

class _SidebarState extends ConsumerState<Sidebar> {
  bool _isAdding = false;
  final _newNameController = TextEditingController();
  String? _renamingId;
  final _renameController = TextEditingController();
  String? _deletingWorkspaceId;

  @override
  void dispose() {
    _newNameController.dispose();
    _renameController.dispose();
    super.dispose();
  }

  void _confirmAdd() {
    final name = _newNameController.text.trim();
    if (name.isNotEmpty) {
      final id = "ws-${DateTime.now().millisecondsSinceEpoch}";
      ref.read(workspaceProvider.notifier).addWorkspace(id: id, name: name);
    }
    setState(() {
      _isAdding = false;
      _newNameController.clear();
    });
  }

  void _confirmRename(String id) {
    final name = _renameController.text.trim();
    if (name.isNotEmpty) {
      ref.read(workspaceProvider.notifier).renameWorkspace(id, name);
    }
    setState(() => _renamingId = null);
  }

  @override
  Widget build(BuildContext context) {
    final uiState = ref.watch(uiProvider);
    final uiNotifier = ref.read(uiProvider.notifier);
    final workspaceState = ref.watch(workspaceProvider);
    final workspaceNotifier = ref.read(workspaceProvider.notifier);
    final collapsed = uiState.sidebarCollapsed;

    return AnimatedContainer(
      duration: const Duration(milliseconds: 220),
      curve: Curves.easeOutCubic,
      width: collapsed ? 60 : 240,
      decoration: const BoxDecoration(
        color: AppColors.bgSidebar,
        border: Border(right: BorderSide(color: AppColors.borderSubtle)),
      ),
      child: ClipRect(
        child: Column(
          children: [
            _LogoHeader(collapsed: collapsed),
            Expanded(
              child: Column(
                children: [
                  _WorkspacesSectionHeader(
                    collapsed: collapsed,
                    isLoading: workspaceState.isHierarchyLoading,
                    onAdd: () => setState(() => _isAdding = true),
                  ),
                  Expanded(
                    child: ListView(
                      padding: const EdgeInsets.symmetric(horizontal: AppSpacing.sm),
                      children: [
                        for (final ws in workspaceState.workspaces)
                          _WorkspaceRow(
                            workspace: ws,
                            collapsed: collapsed,
                            isActive: widget.activeNav == NavTab.investigation &&
                                workspaceState.activeWorkspaceId == ws.id,
                            canDelete: workspaceState.workspaces.length > 1,
                            isRenaming: _renamingId == ws.id,
                            renameController: _renameController,
                            onSelect: () {
                              workspaceNotifier.setActive(ws.id);
                              workspaceNotifier.setActiveFolder(ws.id, null);
                              widget.onNavSelect(NavTab.investigation);
                              workspaceNotifier.fetchHierarchy(ws.id);
                            },
                            onStartRename: () {
                              setState(() {
                                _renamingId = ws.id;
                                _renameController.text = ws.name;
                              });
                            },
                            onConfirmRename: () => _confirmRename(ws.id),
                            onDelete: () => setState(() => _deletingWorkspaceId = ws.id),
                          ),
                        if (_isAdding && !collapsed)
                          Padding(
                            padding: const EdgeInsets.symmetric(horizontal: AppSpacing.xs, vertical: 4),
                            child: Row(
                              children: [
                                Expanded(
                                  child: TextField(
                                    controller: _newNameController,
                                    autofocus: true,
                                    style: AppTypography.body.copyWith(fontSize: 12),
                                    decoration: const InputDecoration(isDense: true, hintText: "Workspace..."),
                                    onSubmitted: (_) => _confirmAdd(),
                                  ),
                                ),
                                IconButton(
                                  iconSize: 14,
                                  color: AppColors.primary,
                                  icon: const Icon(Icons.check),
                                  onPressed: _confirmAdd,
                                ),
                                IconButton(
                                  iconSize: 14,
                                  color: AppColors.textMuted,
                                  icon: const Icon(Icons.close),
                                  onPressed: () => setState(() {
                                    _isAdding = false;
                                    _newNameController.clear();
                                  }),
                                ),
                              ],
                            ),
                          ),
                      ],
                    ),
                  ),
                  _Footer(
                    collapsed: collapsed,
                    activeNav: widget.activeNav,
                    onNavSelect: widget.onNavSelect,
                    onToggleCollapse: uiNotifier.toggleSidebar,
                  ),
                ],
              ),
            ),
          ],
        ),
      ),
    ).let((child) {
      if (_deletingWorkspaceId == null) return child;
      return Stack(
        children: [
          child,
          Positioned.fill(
            child: _DeleteWorkspaceDialogHost(
              onCancel: () => setState(() => _deletingWorkspaceId = null),
              onConfirm: () {
                final id = _deletingWorkspaceId!;
                setState(() => _deletingWorkspaceId = null);
                ref.read(workspaceProvider.notifier).removeWorkspace(id);
              },
            ),
          ),
        ],
      );
    });
  }
}

/// Small extension so the confirmation-dialog host can be spliced onto the
/// end of the build method above without an extra local variable dance.
extension _Let<T> on T {
  R let<R>(R Function(T) f) => f(this);
}

/// Schedules [ConfirmationDialog.show] on the next frame once mounted --
/// lets the delete-confirmation flow live as declarative state
/// (`_deletingWorkspaceId`) rather than an imperative `showDialog` call
/// buried in an `onPressed`, which keeps the workspace-row callbacks free of
/// `BuildContext` plumbing.
class _DeleteWorkspaceDialogHost extends StatefulWidget {
  const _DeleteWorkspaceDialogHost({required this.onCancel, required this.onConfirm});

  final VoidCallback onCancel;
  final VoidCallback onConfirm;

  @override
  State<_DeleteWorkspaceDialogHost> createState() => _DeleteWorkspaceDialogHostState();
}

class _DeleteWorkspaceDialogHostState extends State<_DeleteWorkspaceDialogHost> {
  @override
  void initState() {
    super.initState();
    WidgetsBinding.instance.addPostFrameCallback((_) {
      if (!mounted) return;
      ConfirmationDialog.show(
        context,
        title: "Delete Catalog?",
        description:
            "Are you sure you want to delete this catalog? This will permanently delete all "
            "associated log sources, index files, and clustering history from disk. This action "
            "cannot be undone.",
        variant: ConfirmationVariant.destructive,
        confirmText: "Delete",
        onConfirm: widget.onConfirm,
        onCancel: widget.onCancel,
      );
    });
  }

  @override
  Widget build(BuildContext context) => const SizedBox.shrink();
}

class _LogoHeader extends StatelessWidget {
  const _LogoHeader({required this.collapsed});
  final bool collapsed;

  @override
  Widget build(BuildContext context) {
    return Container(
      height: 64,
      // Collapsed width is 60px total; AppSpacing.md (16px) horizontal
      // padding on each side plus the 34px logo-icon box (20px icon + 6px
      // padding + 1px border, each side) leaves no room to spare and
      // overflows by a few px, so the collapsed rail uses the tighter
      // AppSpacing.sm (8px) padding instead -- still comfortably clears the
      // 64px header height, just narrower horizontally.
      padding: EdgeInsets.symmetric(horizontal: collapsed ? AppSpacing.sm : AppSpacing.md),
      decoration: const BoxDecoration(
        border: Border(bottom: BorderSide(color: AppColors.borderSubtle)),
      ),
      child: Row(
        mainAxisAlignment: collapsed ? MainAxisAlignment.center : MainAxisAlignment.start,
        children: [
          Container(
            padding: const EdgeInsets.all(6),
            decoration: BoxDecoration(
              color: AppColors.primary.withValues(alpha: 0.1),
              border: Border.all(color: AppColors.primary.withValues(alpha: 0.2)),
              borderRadius: BorderRadius.circular(AppRadius.md),
            ),
            child: const Icon(Icons.terminal, size: 20, color: AppColors.primary),
          ),
          if (!collapsed) ...[
            const SizedBox(width: AppSpacing.sm),
            Expanded(
              child: RichText(
                overflow: TextOverflow.ellipsis,
                text: TextSpan(
                  style: AppTypography.h1.copyWith(fontSize: 15),
                  children: const [
                    TextSpan(text: "LogLens"),
                    TextSpan(text: "Ai", style: TextStyle(color: AppColors.primary)),
                  ],
                ),
              ),
            ),
          ],
        ],
      ),
    );
  }
}

class _WorkspacesSectionHeader extends StatelessWidget {
  const _WorkspacesSectionHeader({
    required this.collapsed,
    required this.isLoading,
    required this.onAdd,
  });

  final bool collapsed;
  final bool isLoading;
  final VoidCallback onAdd;

  @override
  Widget build(BuildContext context) {
    if (collapsed) {
      return const Padding(
        padding: EdgeInsets.symmetric(vertical: AppSpacing.md),
        child: Center(
          child: SizedBox(width: 20, height: 1, child: ColoredBox(color: AppColors.borderSubtle)),
        ),
      );
    }
    return Padding(
      padding: const EdgeInsets.fromLTRB(AppSpacing.md, AppSpacing.md, AppSpacing.sm, AppSpacing.sm),
      child: Row(
        children: [
          // Flexible (rather than a bare Text) so this row degrades
          // gracefully -- instead of a hard RenderFlex overflow -- during
          // the ~220ms window where the sidebar's width is still animating
          // toward its expanded target right after `collapsed` flips false
          // (the boolean applies to children instantly; the width doesn't).
          Flexible(
            child: Text(
              "Workspaces",
              overflow: TextOverflow.ellipsis,
              style: AppTypography.labelCaps.copyWith(fontSize: 10),
            ),
          ),
          if (isLoading) ...[
            const SizedBox(width: 6),
            const SizedBox(
              width: 10,
              height: 10,
              child: CircularProgressIndicator(strokeWidth: 1.5, color: AppColors.primary),
            ),
          ],
          const Spacer(),
          IconButton(
            iconSize: 14,
            padding: EdgeInsets.zero,
            constraints: const BoxConstraints(minWidth: 24, minHeight: 24),
            color: AppColors.textMuted,
            icon: const Icon(Icons.add),
            tooltip: "New Workspace",
            onPressed: onAdd,
          ),
        ],
      ),
    );
  }
}

class _WorkspaceRow extends StatelessWidget {
  const _WorkspaceRow({
    required this.workspace,
    required this.collapsed,
    required this.isActive,
    required this.canDelete,
    required this.isRenaming,
    required this.renameController,
    required this.onSelect,
    required this.onStartRename,
    required this.onConfirmRename,
    required this.onDelete,
  });

  final Workspace workspace;
  final bool collapsed;
  final bool isActive;
  final bool canDelete;
  final bool isRenaming;
  final TextEditingController renameController;
  final VoidCallback onSelect;
  final VoidCallback onStartRename;
  final VoidCallback onConfirmRename;
  final VoidCallback onDelete;

  @override
  Widget build(BuildContext context) {
    if (isRenaming) {
      return Padding(
        padding: const EdgeInsets.symmetric(horizontal: AppSpacing.xs, vertical: 4),
        child: Row(
          children: [
            Expanded(
              child: TextField(
                controller: renameController,
                autofocus: true,
                style: AppTypography.body.copyWith(fontSize: 12),
                decoration: const InputDecoration(isDense: true),
                onSubmitted: (_) => onConfirmRename(),
              ),
            ),
            IconButton(
              iconSize: 14,
              color: AppColors.primary,
              icon: const Icon(Icons.check),
              onPressed: onConfirmRename,
            ),
          ],
        ),
      );
    }

    final row = Material(
      color: isActive ? AppColors.primary.withValues(alpha: 0.1) : Colors.transparent,
      borderRadius: BorderRadius.circular(AppRadius.md),
      child: InkWell(
        onTap: onSelect,
        borderRadius: BorderRadius.circular(AppRadius.md),
        child: Container(
          padding: const EdgeInsets.symmetric(horizontal: AppSpacing.xs, vertical: 6),
          decoration: BoxDecoration(
            border: isActive ? Border.all(color: AppColors.primary.withValues(alpha: 0.2)) : null,
            borderRadius: BorderRadius.circular(AppRadius.md),
          ),
          child: Row(
            mainAxisSize: collapsed ? MainAxisSize.min : MainAxisSize.max,
            mainAxisAlignment: collapsed ? MainAxisAlignment.center : MainAxisAlignment.start,
            children: [
              Icon(
                Icons.storage_outlined,
                size: 16,
                color: isActive ? AppColors.primary : AppColors.textMuted,
              ),
              if (!collapsed) ...[
                const SizedBox(width: AppSpacing.sm),
                Expanded(
                  child: Text(
                    workspace.name,
                    maxLines: 1,
                    overflow: TextOverflow.ellipsis,
                    style: AppTypography.body.copyWith(
                      fontSize: 13,
                      fontWeight: FontWeight.w600,
                      color: isActive ? AppColors.primary : AppColors.textSecondary,
                    ),
                  ),
                ),
                IconButton(
                  iconSize: 13,
                  padding: EdgeInsets.zero,
                  constraints: const BoxConstraints(minWidth: 22, minHeight: 22),
                  color: AppColors.textMuted,
                  icon: const Icon(Icons.edit_outlined),
                  onPressed: onStartRename,
                ),
                if (canDelete)
                  IconButton(
                    iconSize: 13,
                    padding: EdgeInsets.zero,
                    constraints: const BoxConstraints(minWidth: 22, minHeight: 22),
                    color: AppColors.error.withValues(alpha: 0.85),
                    icon: const Icon(Icons.delete_outline),
                    onPressed: onDelete,
                  ),
              ],
            ],
          ),
        ),
      ),
    );

    final wrapped = collapsed ? Tooltip(message: workspace.name, child: row) : row;

    if (!isActive || collapsed || workspace.hierarchy == null) {
      return wrapped;
    }

    return Consumer(
      builder: (context, ref, _) {
        final notifier = ref.read(workspaceProvider.notifier);
        return Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          mainAxisSize: MainAxisSize.min,
          children: [
            wrapped,
            Padding(
              padding: const EdgeInsets.only(left: AppSpacing.md, top: 4),
              child: Container(
                padding: const EdgeInsets.only(left: AppSpacing.xs),
                decoration: const BoxDecoration(
                  border: Border(left: BorderSide(color: AppColors.borderSubtle)),
                ),
                child: HierarchyTree(
                  node: workspace.hierarchy!,
                  activeSourceId: workspace.activeSourceId,
                  activeFolderId: workspace.activeFolderId,
                  onSelectSource: (source) {
                    notifier.setActiveSource(workspace.id, source.id);
                  },
                  onSelectFolder: (folder) {
                    notifier.setActiveFolder(workspace.id, folder.id);
                  },
                  onCreateFolder: (parentId, name) => notifier.createFolder(workspace.id, name, parentId: parentId),
                  onRenameFolder: (folderId, name) => notifier.renameFolder(folderId, name),
                  onDeleteFolder: (folderId) => notifier.deleteFolder(folderId),
                  onRenameSource: (sourceId, name) => notifier.renameSource(workspace.id, sourceId, name),
                  onDeleteSource: (sourceId) => notifier.removeSource(workspace.id, sourceId),
                  onMoveSource: (sourceId, folderId) => notifier.moveSource(sourceId, folderId),
                ),
              ),
            ),
          ],
        );
      },
    );
  }
}

class _Footer extends StatelessWidget {
  const _Footer({
    required this.collapsed,
    required this.activeNav,
    required this.onNavSelect,
    required this.onToggleCollapse,
  });

  final bool collapsed;
  final NavTab activeNav;
  final ValueChanged<NavTab> onNavSelect;
  final VoidCallback onToggleCollapse;

  @override
  Widget build(BuildContext context) {
    return Container(
      padding: const EdgeInsets.symmetric(horizontal: AppSpacing.sm, vertical: AppSpacing.md),
      decoration: const BoxDecoration(
        border: Border(top: BorderSide(color: AppColors.borderSubtle)),
        color: AppColors.bgSidebar,
      ),
      child: Column(
        mainAxisSize: MainAxisSize.min,
        children: [
          SidebarNavItem(
            icon: const Icon(Icons.dashboard_outlined),
            label: "Dashboard",
            active: activeNav == NavTab.dashboard,
            collapsed: collapsed,
            onTap: () => onNavSelect(NavTab.dashboard),
          ),
          const SizedBox(height: 2),
          SidebarNavItem(
            icon: const Icon(Icons.settings_outlined),
            label: "Settings",
            active: activeNav == NavTab.settings,
            collapsed: collapsed,
            onTap: () => onNavSelect(NavTab.settings),
          ),
          Padding(
            padding: const EdgeInsets.only(top: AppSpacing.xs),
            child: Container(
              padding: const EdgeInsets.only(top: 6),
              decoration: const BoxDecoration(
                border: Border(top: BorderSide(color: AppColors.borderSubtle)),
              ),
              child: Opacity(
                opacity: 0.7,
                child: SidebarNavItem(
                  icon: Icon(collapsed ? Icons.chevron_right : Icons.chevron_left),
                  label: collapsed ? "Expand Sidebar" : "Collapse Sidebar",
                  active: false,
                  collapsed: collapsed,
                  onTap: onToggleCollapse,
                ),
              ),
            ),
          ),
        ],
      ),
    );
  }
}
