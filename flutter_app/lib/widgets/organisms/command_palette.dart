/// Dart port of `src/components/organisms/CommandPalette.tsx`.
///
/// Cmd/Ctrl-K global command palette: a searchable, grouped command list
/// with arrow-key navigation and Enter-to-activate.
///
/// Deviations from the React source:
///  - The React version tracks no highlighted-item state at all -- Enter
///    always activates `filteredGroups[0].items[0]` and there is no visual
///    "currently selected" row, despite the footer advertising "↑↓
///    navigate". This port implements real highlighted-index state (arrow
///    keys move it, Enter activates it, clamped/reset on search changes) so
///    the advertised keyboard nav actually works, while keeping parity for
///    the no-arrow-keys-pressed case (highlighted index starts at 0, so a
///    bare Enter still activates the first item like the React version).
///  - "Refresh Current Logs" / "Clear Filters & Search" dispatch
///    `window.dispatchEvent(new CustomEvent(...))` in React for other parts
///    of the app to listen for. Flutter has no DOM event bus equivalent;
///    this port exposes them as optional [onRefreshLogs]/[onClearFilters]
///    callbacks instead (no-ops if the caller doesn't supply one).
library;

import "package:flutter/material.dart";
import "package:flutter/services.dart";
import "package:flutter_riverpod/flutter_riverpod.dart";

import "../../providers/ai_provider.dart";
import "../../providers/ui_provider.dart";
import "../../providers/workspace_provider.dart";
import "../../theme/app_theme.dart";

enum CommandPaletteNav { investigation, settings, dashboard }

class _Command {
  const _Command({
    required this.icon,
    required this.label,
    required this.action,
    this.shortcut,
  });

  final IconData icon;
  final String label;
  final VoidCallback action;
  final String? shortcut;
}

class _CommandGroup {
  const _CommandGroup({required this.name, required this.items});
  final String name;
  final List<_Command> items;
}

class CommandPalette extends ConsumerStatefulWidget {
  const CommandPalette({
    super.key,
    required this.onClose,
    required this.onNavSelect,
    this.onRefreshLogs,
    this.onClearFilters,
  });

  final VoidCallback onClose;
  final ValueChanged<CommandPaletteNav> onNavSelect;
  final VoidCallback? onRefreshLogs;
  final VoidCallback? onClearFilters;

  static Future<void> show(
    BuildContext context, {
    required ValueChanged<CommandPaletteNav> onNavSelect,
    VoidCallback? onRefreshLogs,
    VoidCallback? onClearFilters,
  }) {
    return showDialog<void>(
      context: context,
      builder: (dialogContext) => CommandPalette(
        onClose: () => Navigator.of(dialogContext).pop(),
        onNavSelect: onNavSelect,
        onRefreshLogs: onRefreshLogs,
        onClearFilters: onClearFilters,
      ),
    );
  }

  @override
  ConsumerState<CommandPalette> createState() => _CommandPaletteState();
}

class _CommandPaletteState extends ConsumerState<CommandPalette> {
  final _searchController = TextEditingController();
  late final FocusNode _searchFocusNode = FocusNode(onKeyEvent: _handleKeyEvent);
  String _search = "";
  int _highlighted = 0;

  @override
  void dispose() {
    _searchController.dispose();
    _searchFocusNode.dispose();
    super.dispose();
  }

  List<_CommandGroup> _commands() {
    return [
      _CommandGroup(
        name: "Navigation",
        items: [
          _Command(
            icon: Icons.dashboard_outlined,
            label: "Go to Dashboard",
            action: () => widget.onNavSelect(CommandPaletteNav.dashboard),
            shortcut: "G D",
          ),
          _Command(
            icon: Icons.storage_outlined,
            label: "Go to Investigation",
            action: () => widget.onNavSelect(CommandPaletteNav.investigation),
            shortcut: "G I",
          ),
          _Command(
            icon: Icons.settings_outlined,
            label: "Go to Settings",
            action: () => widget.onNavSelect(CommandPaletteNav.settings),
            shortcut: "G S",
          ),
        ],
      ),
      _CommandGroup(
        name: "Actions",
        items: [
          _Command(
            icon: Icons.view_sidebar_outlined,
            label: "Toggle Main Sidebar",
            action: () => ref.read(uiProvider.notifier).toggleSidebar(),
            shortcut: "Ctrl+\\",
          ),
          _Command(
            icon: Icons.smart_toy_outlined,
            label: "Toggle AI Investigation",
            action: () => ref.read(aiProvider.notifier).setSidebarOpen(true),
            shortcut: "Ctrl+J",
          ),
          _Command(
            icon: Icons.filter_alt_outlined,
            label: "Toggle Facet Sidebar",
            action: () => ref.read(uiProvider.notifier).toggleFacetSidebar(),
            shortcut: "Ctrl+F",
          ),
          _Command(
            icon: Icons.add_circle_outline,
            label: "New Workspace",
            action: () => ref.read(workspaceProvider.notifier).addWorkspace(
              id: "ws-${DateTime.now().millisecondsSinceEpoch}",
              name: "New Workspace",
            ),
            shortcut: "Ctrl+N",
          ),
        ],
      ),
      _CommandGroup(
        name: "Investigation",
        items: [
          _Command(
            icon: Icons.refresh,
            label: "Refresh Current Logs",
            action: () => widget.onRefreshLogs?.call(),
            shortcut: "R",
          ),
          _Command(
            icon: Icons.cancel_outlined,
            label: "Clear Filters & Search",
            action: () => widget.onClearFilters?.call(),
            shortcut: "Esc",
          ),
        ],
      ),
    ];
  }

  List<_CommandGroup> _filteredGroups() {
    final commands = _commands();
    if (_search.isEmpty) return commands;
    final query = _search.toLowerCase();
    return commands
        .map(
          (g) => _CommandGroup(
            name: g.name,
            items: g.items.where((i) => i.label.toLowerCase().contains(query)).toList(),
          ),
        )
        .where((g) => g.items.isNotEmpty)
        .toList();
  }

  List<_Command> _flatItems(List<_CommandGroup> groups) =>
      groups.expand((g) => g.items).toList();

  void _handleAction(_Command command) {
    command.action();
    widget.onClose();
  }

  void _moveHighlight(int delta, int itemCount) {
    if (itemCount == 0) return;
    setState(() {
      _highlighted = (_highlighted + delta) % itemCount;
      if (_highlighted < 0) _highlighted += itemCount;
    });
  }

  KeyEventResult _handleKeyEvent(FocusNode node, KeyEvent event) {
    if (event is! KeyDownEvent) return KeyEventResult.ignored;
    final items = _flatItems(_filteredGroups());

    if (event.logicalKey == LogicalKeyboardKey.arrowDown) {
      _moveHighlight(1, items.length);
      return KeyEventResult.handled;
    }
    if (event.logicalKey == LogicalKeyboardKey.arrowUp) {
      _moveHighlight(-1, items.length);
      return KeyEventResult.handled;
    }
    if (event.logicalKey == LogicalKeyboardKey.enter ||
        event.logicalKey == LogicalKeyboardKey.numpadEnter) {
      if (items.isNotEmpty) {
        final idx = _highlighted.clamp(0, items.length - 1);
        _handleAction(items[idx]);
      }
      return KeyEventResult.handled;
    }
    if (event.logicalKey == LogicalKeyboardKey.escape) {
      widget.onClose();
      return KeyEventResult.handled;
    }
    return KeyEventResult.ignored;
  }

  @override
  Widget build(BuildContext context) {
    final groups = _filteredGroups();
    final flat = _flatItems(groups);
    final highlighted = flat.isEmpty ? -1 : _highlighted.clamp(0, flat.length - 1);
    var runningIndex = 0;

    return Dialog(
      backgroundColor: AppColors.bgBase.withValues(alpha: 0.9),
      shape: RoundedRectangleBorder(
        borderRadius: BorderRadius.circular(AppRadius.lg),
        side: BorderSide(color: AppColors.border.withValues(alpha: 0.6)),
      ),
      child: ConstrainedBox(
        constraints: const BoxConstraints(maxWidth: 640, maxHeight: 560),
        child: Column(
          mainAxisSize: MainAxisSize.min,
          children: [
            Padding(
              padding: const EdgeInsets.all(AppSpacing.md),
              child: TextField(
                controller: _searchController,
                focusNode: _searchFocusNode,
                autofocus: true,
                decoration: const InputDecoration(
                  prefixIcon: Icon(Icons.search, size: 18),
                  hintText: "Type a command or search...",
                  isDense: true,
                ),
                onChanged: (v) => setState(() {
                  _search = v;
                  _highlighted = 0;
                }),
              ),
            ),
            const Divider(height: 1),
            Flexible(
              child: groups.isEmpty
                  ? Padding(
                      padding: const EdgeInsets.all(AppSpacing.xl),
                      child: Text(
                        "No matching commands found.",
                        textAlign: TextAlign.center,
                        style: AppTypography.body.copyWith(
                          color: AppColors.textMuted,
                          fontStyle: FontStyle.italic,
                        ),
                      ),
                    )
                  : ListView(
                      shrinkWrap: true,
                      padding: const EdgeInsets.all(AppSpacing.sm),
                      children: [
                        for (final group in groups) ...[
                          Padding(
                            padding: const EdgeInsets.symmetric(
                              horizontal: AppSpacing.sm,
                              vertical: 6,
                            ),
                            child: Text(
                              group.name.toUpperCase(),
                              style: AppTypography.labelCaps,
                            ),
                          ),
                          for (final item in group.items) ...[
                            Builder(
                              builder: (context) {
                                final isHighlighted = runningIndex == highlighted;
                                runningIndex++;
                                return _CommandRow(
                                  command: item,
                                  highlighted: isHighlighted,
                                  onTap: () => _handleAction(item),
                                );
                              },
                            ),
                          ],
                        ],
                      ],
                    ),
            ),
            const Divider(height: 1),
            Padding(
              padding: const EdgeInsets.symmetric(
                horizontal: AppSpacing.md,
                vertical: AppSpacing.sm,
              ),
              child: Row(
                mainAxisAlignment: MainAxisAlignment.spaceBetween,
                children: [
                  Row(
                    children: [
                      _KbdHint("↵"),
                      const SizedBox(width: 4),
                      Text(
                        "select",
                        style: AppTypography.body.copyWith(fontSize: 10, color: AppColors.textMuted),
                      ),
                      const SizedBox(width: AppSpacing.md),
                      _KbdHint("↑↓"),
                      const SizedBox(width: 4),
                      Text(
                        "navigate",
                        style: AppTypography.body.copyWith(fontSize: 10, color: AppColors.textMuted),
                      ),
                    ],
                  ),
                  Text(
                    "COMMAND PALETTE",
                    style: AppTypography.body.copyWith(
                      fontSize: 10,
                      color: AppColors.textMuted.withValues(alpha: 0.6),
                      letterSpacing: 1,
                    ),
                  ),
                ],
              ),
            ),
          ],
        ),
      ),
    );
  }
}

class _CommandRow extends StatelessWidget {
  const _CommandRow({required this.command, required this.highlighted, required this.onTap});

  final _Command command;
  final bool highlighted;
  final VoidCallback onTap;

  @override
  Widget build(BuildContext context) {
    return Material(
      color: highlighted ? AppColors.bgHover : Colors.transparent,
      borderRadius: BorderRadius.circular(AppRadius.md),
      child: InkWell(
        borderRadius: BorderRadius.circular(AppRadius.md),
        onTap: onTap,
        child: Container(
          decoration: BoxDecoration(
            border: Border.all(
              color: highlighted ? AppColors.primary.withValues(alpha: 0.3) : Colors.transparent,
            ),
            borderRadius: BorderRadius.circular(AppRadius.md),
          ),
          padding: const EdgeInsets.symmetric(horizontal: AppSpacing.sm + 2, vertical: 10),
          child: Row(
            mainAxisAlignment: MainAxisAlignment.spaceBetween,
            children: [
              Row(
                children: [
                  Icon(
                    command.icon,
                    size: 16,
                    color: highlighted ? AppColors.primary : AppColors.textSecondary,
                  ),
                  const SizedBox(width: AppSpacing.sm + 4),
                  Text(
                    command.label,
                    style: AppTypography.body.copyWith(
                      fontWeight: FontWeight.w500,
                      color: highlighted ? AppColors.textPrimary : AppColors.textSecondary,
                    ),
                  ),
                ],
              ),
              if (command.shortcut != null)
                Row(
                  mainAxisSize: MainAxisSize.min,
                  children: [
                    for (final key in command.shortcut!.split(" "))
                      Padding(
                        padding: const EdgeInsets.only(left: 4),
                        child: _KbdHint(key),
                      ),
                  ],
                ),
            ],
          ),
        ),
      ),
    );
  }
}

class _KbdHint extends StatelessWidget {
  const _KbdHint(this.text);
  final String text;

  @override
  Widget build(BuildContext context) {
    return Container(
      padding: const EdgeInsets.symmetric(horizontal: 6, vertical: 2),
      decoration: BoxDecoration(
        color: AppColors.bgSurfaceBright,
        borderRadius: BorderRadius.circular(AppRadius.sm),
        border: Border.all(color: AppColors.border),
      ),
      child: Text(
        text,
        style: AppTypography.log.copyWith(fontSize: 10, color: AppColors.textPrimary),
      ),
    );
  }
}
