/// Dart port of `src/components/molecules/WorkspaceTabs.tsx`.
///
/// Horizontal, scrollable strip of closeable tabs for switching between log
/// sources within the active workspace. Each tab shows the source name (or
/// basename of its path), a live-tailing pulse dot, a fusion-source
/// indicator, and rename/edit/remove actions.
library;

import "package:flutter/material.dart";

import "../../models/workspace.dart";
import "../../theme/app_colors.dart";
import "../../theme/app_typography.dart";
import "../atoms/src/pulse_animations.dart";

class WorkspaceTabs extends StatefulWidget {
  const WorkspaceTabs({
    super.key,
    required this.sources,
    required this.activeSourceId,
    this.tailingSourceIds = const {},
    required this.onSelectSource,
    this.onRemoveSource,
    this.onEditFusion,
    this.onRenameSource,
    required this.activeWorkspaceId,
  });

  /// All sources attached to the active workspace.
  final List<LogSource> sources;

  /// Currently-active source id, or `null` for the aggregate "All" view.
  final String? activeSourceId;

  /// Set of source IDs that are currently live-tailing.
  final Set<String> tailingSourceIds;

  /// Called when the user selects a tab (`null` is never passed here since
  /// there's no explicit "All" tab rendered by this widget -- mirrors the
  /// React source, which only renders per-source tabs).
  final ValueChanged<String?> onSelectSource;

  /// Called when the user removes a source tab. Omit to hide the close (X)
  /// button entirely.
  final ValueChanged<String>? onRemoveSource;

  /// Called when the user wants to edit a fusion-type tab's config.
  final ValueChanged<String>? onEditFusion;

  /// Called when the user renames a source tab: `(workspaceId, sourceId,
  /// newName)`.
  final void Function(String workspaceId, String sourceId, String name)? onRenameSource;

  final String activeWorkspaceId;

  @override
  State<WorkspaceTabs> createState() => _WorkspaceTabsState();
}

class _WorkspaceTabsState extends State<WorkspaceTabs> {
  String? _editingId;
  late final TextEditingController _renameController = TextEditingController();

  @override
  void dispose() {
    _renameController.dispose();
    super.dispose();
  }

  void _startRename(String id, String currentName) {
    setState(() {
      _editingId = id;
      _renameController.text = currentName;
    });
  }

  void _confirmRename(String id) {
    final trimmed = _renameController.text.trim();
    if (widget.onRenameSource != null && trimmed.isNotEmpty) {
      widget.onRenameSource!(widget.activeWorkspaceId, id, trimmed);
    }
    setState(() => _editingId = null);
  }

  @override
  Widget build(BuildContext context) {
    if (widget.sources.isEmpty) {
      return const SizedBox.shrink();
    }

    return SizedBox(
      height: 36,
      child: Semantics(
        label: "Log source tabs",
        container: true,
        child: ListView.separated(
          scrollDirection: Axis.horizontal,
          itemCount: widget.sources.length + 1,
          separatorBuilder: (context, index) => const SizedBox(width: 2),
          itemBuilder: (context, index) {
            if (index == widget.sources.length) {
              // Trailing divider, mirrors the React `h-4 w-px bg-border/60`.
              return Container(
                width: 1,
                height: 16,
                margin: const EdgeInsets.symmetric(horizontal: 4),
                color: AppColors.border.withValues(alpha: 0.6),
              );
            }
            final src = widget.sources[index];
            return _WorkspaceTab(
              source: src,
              isActive: widget.activeSourceId == src.id,
              isTailing: widget.tailingSourceIds.contains(src.id),
              isEditing: _editingId == src.id,
              nameController: _renameController,
              onSelect: () => widget.onSelectSource(src.id),
              onStartRename: widget.onRenameSource == null
                  ? null
                  : () => _startRename(src.id, _labelFor(src)),
              onConfirmRename: () => _confirmRename(src.id),
              onCancelRename: () => setState(() => _editingId = null),
              onEditFusion: widget.onEditFusion == null ? null : () => widget.onEditFusion!(src.id),
              onRemove: widget.onRemoveSource == null ? null : () => widget.onRemoveSource!(src.id),
            );
          },
        ),
      ),
    );
  }

  static String _labelFor(LogSource src) {
    if (src.name.isNotEmpty) return src.name;
    final parts = src.path.split(RegExp(r"[\\/]"));
    return parts.isNotEmpty && parts.last.isNotEmpty ? parts.last : src.path;
  }
}

class _WorkspaceTab extends StatelessWidget {
  const _WorkspaceTab({
    required this.source,
    required this.isActive,
    required this.isTailing,
    required this.isEditing,
    required this.nameController,
    required this.onSelect,
    required this.onStartRename,
    required this.onConfirmRename,
    required this.onCancelRename,
    required this.onEditFusion,
    required this.onRemove,
  });

  final LogSource source;
  final bool isActive;
  final bool isTailing;
  final bool isEditing;
  final TextEditingController nameController;
  final VoidCallback onSelect;
  final VoidCallback? onStartRename;
  final VoidCallback onConfirmRename;
  final VoidCallback onCancelRename;
  final VoidCallback? onEditFusion;
  final VoidCallback? onRemove;

  bool get _isFusion => source.type == "fusion";

  @override
  Widget build(BuildContext context) {
    final label = _WorkspaceTabsState._labelFor(source);

    final Color bg;
    final Color border;
    final Color fg;
    if (isActive) {
      bg = _isFusion
          ? AppColors.accentViolet.withValues(alpha: 0.15)
          : AppColors.primary.withValues(alpha: 0.15);
      border = _isFusion
          ? AppColors.accentViolet.withValues(alpha: 0.3)
          : AppColors.primary.withValues(alpha: 0.3);
      fg = _isFusion ? AppColors.accentViolet : AppColors.primary;
    } else {
      bg = Colors.transparent;
      border = Colors.transparent;
      fg = AppColors.textMuted;
    }

    return Tooltip(
      message: source.path,
      child: Container(
        decoration: BoxDecoration(
          color: bg,
          border: Border.all(color: border),
          borderRadius: BorderRadius.circular(6),
        ),
        padding: const EdgeInsets.symmetric(horizontal: 2),
        child: Row(
          mainAxisSize: MainAxisSize.min,
          children: [
            Material(
              color: Colors.transparent,
              child: InkWell(
                borderRadius: BorderRadius.circular(6),
                onTap: onSelect,
                child: Padding(
                  padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 8),
                  child: Row(
                    mainAxisSize: MainAxisSize.min,
                    children: [
                      if (_isFusion)
                        Padding(
                          padding: const EdgeInsets.only(right: 4),
                          child: Text(
                            "⚡",
                            style: TextStyle(
                              fontSize: 9,
                              fontWeight: FontWeight.w700,
                              color: AppColors.accentViolet.withValues(alpha: 0.7),
                            ),
                          ),
                        ),
                      if (!_isFusion && isTailing)
                        Padding(
                          padding: const EdgeInsets.only(right: 6),
                          child: SizedBox(
                            width: 8,
                            height: 8,
                            child: Semantics(
                              label: "Live tailing",
                              child: Stack(
                                alignment: Alignment.center,
                                children: [
                                  PingDot(color: AppColors.primary, size: 8),
                                  Container(
                                    width: 8,
                                    height: 8,
                                    decoration: const BoxDecoration(
                                      color: AppColors.primary,
                                      shape: BoxShape.circle,
                                    ),
                                  ),
                                ],
                              ),
                            ),
                          ),
                        ),
                      if (isEditing)
                        SizedBox(
                          width: 140,
                          child: TextField(
                            controller: nameController,
                            autofocus: true,
                            style: AppTypography.log.copyWith(
                              fontSize: 11,
                              fontWeight: FontWeight.w600,
                              color: AppColors.primary,
                            ),
                            onSubmitted: (_) => onConfirmRename(),
                            onTapOutside: (_) => onConfirmRename(),
                            decoration: InputDecoration(
                              isDense: true,
                              filled: true,
                              fillColor: AppColors.primary.withValues(alpha: 0.2),
                              contentPadding: const EdgeInsets.symmetric(
                                horizontal: 6,
                                vertical: 4,
                              ),
                              border: OutlineInputBorder(
                                borderRadius: BorderRadius.circular(4),
                                borderSide: BorderSide(
                                  color: AppColors.primary.withValues(alpha: 0.3),
                                ),
                              ),
                            ),
                          ),
                        )
                      else
                        ConstrainedBox(
                          constraints: const BoxConstraints(maxWidth: 140),
                          child: Text(
                            label,
                            overflow: TextOverflow.ellipsis,
                            style: AppTypography.log.copyWith(
                              fontSize: 11,
                              fontWeight: FontWeight.w600,
                              color: fg,
                            ),
                          ),
                        ),
                    ],
                  ),
                ),
              ),
            ),
            if (onStartRename != null && !isEditing)
              _TabIconButton(
                icon: Icons.edit_outlined,
                tooltip: "Rename $label",
                color: fg,
                onPressed: onStartRename!,
              ),
            if (_isFusion && onEditFusion != null)
              _TabIconButton(
                icon: Icons.settings_outlined,
                tooltip: "Configure Fusion $label",
                color: fg,
                onPressed: onEditFusion!,
              ),
            if (onRemove != null)
              _TabIconButton(
                icon: Icons.close,
                tooltip: "Remove $label",
                color: fg,
                onPressed: onRemove!,
              ),
          ],
        ),
      ),
    );
  }
}

class _TabIconButton extends StatelessWidget {
  const _TabIconButton({
    required this.icon,
    required this.tooltip,
    required this.color,
    required this.onPressed,
  });

  final IconData icon;
  final String tooltip;
  final Color color;
  final VoidCallback onPressed;

  @override
  Widget build(BuildContext context) {
    return IconButton(
      icon: Icon(icon, size: 12),
      color: color,
      tooltip: tooltip,
      splashRadius: 12,
      padding: EdgeInsets.zero,
      constraints: const BoxConstraints(minWidth: 20, minHeight: 20),
      onPressed: onPressed,
    );
  }
}
