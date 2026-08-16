# 🎨 Frontend Architecture

> **Init File** — Populate this file when the frontend is scaffolded. The AI uses this as the source of truth for all widget creation, routing, state management, and styling decisions.

> **Migration note (2026-08)**: this file previously described the React/Tauri frontend (`src/`). It has been rewritten for the Flutter frontend (`flutter_app/`) that replaced it — a pixel-parity rebuild verified with a real Windows build and 293 passing tests. See `docs/migration/STATUS.md` for the full record, including real bugs found/fixed during the port (a `SliverReorderableList` drag crash, a `Stack`-sizing bug, an unhandled async rejection, several `RenderFlex` overflows, a `late`-initializer-timing bug).

<!-- AI_PROMPT: Before creating any new widget, page, or provider, read this file.
     Register every new Organism and Page here as it is built.
     Do not create widgets that duplicate existing ones listed below.
     Cross-reference `state_management.md` (superseded — see its own deprecation note) for the
     original Zustand store shapes the Riverpod providers mirror. -->

---

## 🏗️ Widget Hierarchy (Atomic Design)

> Register widgets as they are created. Follow the strict hierarchy — never put business logic in Atoms.

### ⚛️ Atoms *(pure, stateless, no provider access)* — 13 total

`flutter_app/lib/widgets/atoms/`: `status_dot.dart`, `log_level_badge.dart`, `help_tooltip.dart`, `icon_button.dart`, `ingestion_progress_badge.dart`, `tail_switch.dart`, `typing_indicator.dart`, `stat_card.dart`, `a2ui_renderer.dart`, `markdown_content.dart`, `thinking_block.dart`, `app_chart_container.dart`, `sidebar_nav_item.dart` (plus `src/pulse_animations.dart` helper).

### 🧬 Molecules *(composed atoms, minimal logic)* — 18 total

`flutter_app/lib/widgets/molecules/`: `level_bar.dart`, `ingestion_overlay.dart`, `native_file_picker.dart`, `dashboard_mode_toggle.dart`, `search_bar.dart`, `cluster_row.dart`, `add_column_modal.dart`, `source_item.dart`, `source_selector.dart`, `facet_extraction_settings.dart`, `workspace_tabs.dart`, `filter_builder.dart`, `facet_list.dart`, `highlight_builder.dart`, `time_range_picker.dart`, `hierarchy_tree.dart`, `processing_notification.dart`, `confirmation_dialog.dart`.

### 🦠 Organisms *(data-bound, may access Riverpod providers)* — 21 total

`flutter_app/lib/widgets/organisms/`: `ai_history_search_modal.dart`, `log_toolbar.dart`, `command_palette.dart`, `facet_sidebar.dart`, `template_codec.dart`, `time_shift_modal.dart`, `custom_parser_modal.dart`, `load_template_modal.dart`, `diagnostic_sidebar.dart`, `save_template_modal.dart`, `fusion_config_engine.dart`, `explorer_view.dart`, `virtual_log_table.dart`, `import_feed_modal.dart`, `dashboard_charts.dart`, `ai_investigation_sidebar.dart`, `column_manager_sidebar.dart`, `orchestrator_hub.dart`, `log_distribution_widget.dart`, `sidebar.dart`, `system_diagnostic_console.dart`, `settings_panel.dart`.

### 📄 Pages & App Shell

| Page | File | Description |
|------|------|-------------|
| Dashboard | `flutter_app/lib/pages/dashboard_page.dart` | Stat tiles, charts, AI-insights mode |
| Investigation | `flutter_app/lib/pages/investigation_page.dart` | Core log analysis view |
| Settings | `flutter_app/lib/pages/settings_page.dart` | AI provider + Drain3 config + preferences |

App shell: `flutter_app/lib/app.dart` — real 3-column layout (Sidebar 240/60px collapsible, main content, `DiagnosticSidebar` 384px), Cmd/Ctrl-K command palette wired.

---

## 🗃️ State Management

> See `docs/architecture/state_management.md` for the pre-migration Zustand strategy this mirrors (that file itself is not updated — see its deprecation note).

### Active Providers (Riverpod `StateNotifier`s)

`flutter_app/lib/providers/`, one per domain, mirroring the shapes/actions of the original 9 Zustand stores:

| Provider | File Path |
|----------|-----------|
| Sidecar (IPC status) | `sidecar_provider.dart` |
| UI (layout/panel state) | `ui_provider.dart` |
| Investigation | `investigation_provider.dart` |
| Clustering | `clustering_provider.dart` |
| Health | `health_provider.dart` |
| Debug | `debug_provider.dart` |
| Ingestion | `ingestion_provider.dart` |
| AI | `ai_provider.dart` |
| Fusion | `fusion_provider.dart` |
| Workspace | `workspace_provider.dart` |
| Template | `template_provider.dart` |
| Distribution | `distribution_provider.dart` |
| Settings | `settings_provider.dart` |
| Dashboard | `dashboard_provider.dart` |

---

## 🧭 Routing

- **Router**: no formal router package — `flutter_app/lib/app.dart` switches between the three pages (Dashboard/Investigation/Settings) inside the persistent 3-column shell via a selected-page provider, plus a Cmd/Ctrl-K command palette overlay.
- **Route Guard**: none — single-user local desktop app, no auth.

### Route Map

```
Dashboard      → DashboardPage
Investigation  → InvestigationPage (default)
Settings       → SettingsPage
```

---

## 🔌 Bridge Service (Frontend ↔ Backend)

> All backend calls go through this service. Never spawn or talk to the sidecar process directly from a widget.

```dart
// flutter_app/lib/services/sidecar_bridge.dart
class SidecarBridge {
  Future<T> callSidecar<T>(String method, Map<String, dynamic> params) async {
    // dual-mode: stdio subprocess (prod default) or HTTP :5000/rpc (dev fallback)
    // see communication.md for the JSON-RPC 2.0 envelope
  }
}
```

**Registered usages:** every Riverpod provider in `flutter_app/lib/providers/` calls through `SidecarBridge` for its RPC methods — see `docs/architecture/layers/backend.md` for the full method table.

---

## 🎨 Design System Tokens

> Token source: `DESIGN.md`, ported verbatim into `flutter_app/lib/theme/` (`app_colors.dart`, `app_spacing.dart`, `app_typography.dart`, `app_theme.dart`). Dark-only theme; a custom `ThemeExtension` covers glow/glass tokens Material has no built-in slot for.

| Token | Dart Source | Value |
|-------|-------------|-------|
| Primary | `AppColors.primary` | `#22C55E` |
| Background | `AppColors.bgBase` | `#0D0F0E` |
| Typography | `AppTypography` | *(see `app_typography.dart`)* |

**Rule**: Hardcoded hex values are strictly forbidden. Always use the `flutter_app/lib/theme/` tokens.

---

## 📜 Frontend Rules

> From `.agents/rules/System/Architecture.md` and `CodeQuality.md`

1. **Atoms are stateless** — No provider access, no async calls, no side effects.
2. **Organisms own data** — Organisms connect to Riverpod providers and call `SidecarBridge`.
3. **No nested interactive elements** — Use `Semantics(button: true)`/`InkWell` deliberately, avoid overlapping gesture regions.
4. **Motion always** — No widget appears/disappears without a transition (`AnimatedOpacity`/`AnimatedSize`/implicit animations).
5. **Token adherence** — No hardcoded hex/px. `flutter_app/lib/theme/` tokens only.
6. **Focus rings** — All interactive elements must have visible focus states (`FocusNode` + `Focus`/`FocusTraversalGroup`).
7. **Doc comments** — All exported widgets and providers should have `///` doc comments.

---

## 🔗 References

- **State Strategy (superseded)**: `docs/architecture/state_management.md`
- **Communication**: `docs/architecture/communication.md`
- **Design Tokens**: `DESIGN.md`
- **Stack**: `docs/architecture/stack.md` → Frontend Framework + UI Component Library sections
- **Migration Record**: `docs/migration/STATUS.md`
