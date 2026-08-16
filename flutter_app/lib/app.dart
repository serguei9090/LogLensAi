/// Dart port of `src/App.tsx` + `src/components/templates/AppLayout.tsx`.
///
/// Real app shell: a 3-column row (`Sidebar` | active page |
/// `DiagnosticSidebar`) wrapping whichever of [DashboardPage] /
/// [InvestigationPage] / [SettingsPage] is active, plus a global Ctrl/Cmd-K
/// listener that opens [CommandPalette] and a handful of other global
/// shortcuts mirroring `App.tsx`'s `useKeyboardShortcuts` registrations.
///
/// Deviations from the React source:
///  - React lazy-loads all three pages via `React.lazy`/`Suspense`; Dart
///    compiles everything ahead of time, so there is no equivalent
///    lazy-boundary/loading-spinner state to port -- the page widgets are
///    just built directly.
///  - `AppLayout`'s `DndContext` (react-dnd-kit, for dragging a source card
///    onto a folder to move it) is not ported, matching every other organism
///    in this codebase that stubs drag-and-drop (`HierarchyTree`,
///    `ExplorerView`, `ColumnManagerSidebar` all note the same call) --
///    reproducing a DnD engine is out of scope for this pass. `AppLayout`'s
///    ingestion-jobs restore-on-mount effect is investigation-page-level
///    concern in this port (nothing in the shell reads `ingestionStore`
///    directly), so it isn't reproduced here either.
///  - React's `useKeyboardShortcuts` reads the *configurable*
///    `settings.ui_command_palette_shortcut` for the command-palette binding.
///    Per this pass's brief, the Flutter binding is hardcoded to Ctrl/Cmd+K
///    instead of threading the settings-driven shortcut through -- the other
///    three global shortcuts (toggle sidebar / AI panel / facet sidebar) are
///    hardcoded in the React source too, so this only narrows the one
///    configurable case.
///  - `SystemDiagnosticConsole` is a floating bottom-right overlay in both
///    versions; here it's the top layer of a root [Stack] instead of a
///    `fixed`-positioned DOM node, per that widget's own documented port
///    convention.
///  - `DiagnosticSidebar` stays permanently closed (`open: false`), matching
///    `AppLayout`'s current `diagnosticOpen={false}` wiring in the React
///    source verbatim -- it's built but not yet reachable from the live UI
///    on either side.
library;

import "package:flutter/material.dart";
import "package:flutter/services.dart";
import "package:flutter_riverpod/flutter_riverpod.dart";

import "pages/dashboard_page.dart";
import "pages/investigation_page.dart";
import "pages/settings_page.dart";
import "providers/ai_provider.dart";
import "providers/settings_provider.dart";
import "providers/ui_provider.dart";
import "theme/app_theme.dart";
import "widgets/organisms/command_palette.dart";
import "widgets/organisms/diagnostic_sidebar.dart";
import "widgets/organisms/sidebar.dart";
import "widgets/organisms/system_diagnostic_console.dart";

/// Mirrors `export type NavTab = "investigation" | "settings" | "dashboard"`
/// in `src/App.tsx`.
enum NavTab { dashboard, investigation, settings }

class LogLensApp extends StatelessWidget {
  const LogLensApp({super.key});

  @override
  Widget build(BuildContext context) {
    return MaterialApp(
      title: "LogLensAi",
      debugShowCheckedModeBanner: false,
      theme: AppTheme.dark,
      darkTheme: AppTheme.dark,
      themeMode: ThemeMode.dark,
      home: const AppShell(),
    );
  }
}

class AppShell extends ConsumerStatefulWidget {
  const AppShell({super.key});

  @override
  ConsumerState<AppShell> createState() => _AppShellState();
}

class _AppShellState extends ConsumerState<AppShell> {
  NavTab _activeNav = NavTab.dashboard;

  @override
  void initState() {
    super.initState();
    // Mirrors App.tsx's `useEffect(() => { fetchSettings(); }, [])`.
    WidgetsBinding.instance.addPostFrameCallback((_) {
      ref.read(settingsProvider.notifier).fetchSettings();
    });
  }

  void _handleNavSelect(NavTab nav) {
    if (nav == _activeNav) return;
    setState(() => _activeNav = nav);
  }

  void _handleCommandPaletteNav(CommandPaletteNav nav) {
    switch (nav) {
      case CommandPaletteNav.dashboard:
        _handleNavSelect(NavTab.dashboard);
      case CommandPaletteNav.investigation:
        _handleNavSelect(NavTab.investigation);
      case CommandPaletteNav.settings:
        _handleNavSelect(NavTab.settings);
    }
  }

  void _openCommandPalette() {
    CommandPalette.show(context, onNavSelect: _handleCommandPaletteNav);
  }

  /// Global keyboard shortcut handling, mirrors `App.tsx`'s
  /// `useKeyboardShortcuts` block (command palette / toggle sidebar / toggle
  /// AI panel / toggle facet sidebar). A raw [Focus.onKeyEvent] listener
  /// (rather than [Shortcuts]/[Actions]) keeps this close to how
  /// `CommandPalette` itself already implements its own arrow-key nav in
  /// this codebase.
  KeyEventResult _handleKeyEvent(FocusNode node, KeyEvent event) {
    if (event is! KeyDownEvent) return KeyEventResult.ignored;
    final isMod =
        HardwareKeyboard.instance.isControlPressed || HardwareKeyboard.instance.isMetaPressed;
    if (!isMod) return KeyEventResult.ignored;

    switch (event.logicalKey) {
      case LogicalKeyboardKey.keyK:
        _openCommandPalette();
        return KeyEventResult.handled;
      case LogicalKeyboardKey.keyB:
        ref.read(uiProvider.notifier).toggleSidebar();
        return KeyEventResult.handled;
      case LogicalKeyboardKey.keyJ:
        ref.read(aiProvider.notifier).setSidebarOpen(true);
        return KeyEventResult.handled;
      case LogicalKeyboardKey.keyF:
        ref.read(uiProvider.notifier).toggleFacetSidebar();
        return KeyEventResult.handled;
      default:
        return KeyEventResult.ignored;
    }
  }

  @override
  Widget build(BuildContext context) {
    return Focus(
      autofocus: true,
      onKeyEvent: _handleKeyEvent,
      child: Scaffold(
        backgroundColor: AppColors.bgApp,
        body: Stack(
          children: [
            Row(
              children: [
                Sidebar(activeNav: _activeNav, onNavSelect: _handleNavSelect),
                Expanded(
                  child: ColoredBox(
                    color: AppColors.bgBase,
                    child: _buildPage(_activeNav),
                  ),
                ),
                DiagnosticSidebar(
                  open: false,
                  onClose: () {},
                  data: null,
                  loading: false,
                ),
              ],
            ),
            const SystemDiagnosticConsole(),
          ],
        ),
      ),
    );
  }

  Widget _buildPage(NavTab nav) {
    switch (nav) {
      case NavTab.dashboard:
        return const DashboardPage();
      case NavTab.investigation:
        return const InvestigationPage();
      case NavTab.settings:
        return const SettingsPage();
    }
  }
}
