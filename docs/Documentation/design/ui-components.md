# LogLensAi - UI Components Registry

> All UI primitives must be installed from **shadcn/ui** using the **shadcn** skill and styled with the project theme tokens.
> Run `bunx --bun shadcn@latest add <component>` for each.

## 🧱 shadcn UI Primitives (`src/components/ui/`)

| Component | shadcn name | Purpose |
|---|---|---|
| Button | `button` | All CTA actions (import, filter, settings) |
| Input | `input` | Search bar, filter inputs, settings text fields |
| Label | `label` | Form labels in settings and modals |
| Switch | `switch` | Live Tail toggle (toolbar + import modal) |
| Badge | `badge` | Log level labels (ERROR, WARN, INFO, DEBUG) |
| Tooltip | `tooltip` | Help text on Drain3 config, settings fields |
| Dialog | `dialog` | Import log modal, confirmation dialogs |
| Popover | `popover` | Filter builder panel, highlight color picker |
| Select | `select` | AI provider selector, log level filter dropdown |
| Separator | `separator` | Section dividers in settings and sidebar |
| ScrollArea | `scroll-area` | Log table scroll container |
| Tabs | `tabs` | Settings page sections, import modal (Local/SSH/Manual) |
| Card | `card` | Settings section cards, workspace cards |
| Dropdown Menu | `dropdown-menu` | Context menus, sort options |
| Table | `table` | Log table base structure |
| Skeleton | `skeleton` | Loading placeholder for log rows |
| Toast | `sonner` | Notifications (ingest success/failure, copy, etc.) |
| Accordion | `accordion` | Collapsible sections in sidebars |
| Checkbox | `checkbox` | Multi-select options in filters/facets |
| Context Menu | `context-menu` | Right-click actions on logs/sources |

---

## 🏗️ Atomic Layer Components

### Atoms (`src/components/atoms/`)
Smallest functional units, usually wrapping a single UI primitive.
- `A2UIRenderer` — Renders Agent-to-UI protocol JSON into interactive blocks.
- `HelpTooltip` — Wraps `Tooltip` with a `?` icon trigger.
- `IconButton` — Wraps `Button` (ghost) with an icon only.
- `LogLevelBadge` — Wraps `Badge`, applying level-specific colors (ERROR, WARN, etc.).
- `MarkdownContent` — Renders markdown text with project-specific styling.
- `StatusDot` — A pulsing dot (green/amber) indicating status or live activity.
- `TailSwitch` — Wraps `Switch` with a label for live tailing.
- `ThinkingBlock` — Collapsible reasoning block for AI thoughts (`<think>`).
- `TypingIndicator` — Visual indicator for AI "typing" state.

### Molecules (`src/components/molecules/`)
Groups of atoms functioning together as a unit.
- `ConfirmationDialog` — Reusable alert dialog for destructive actions.
- `FacetExtractionSettings` — UI for configuring regex-based metadata extraction.
- `FacetList` — List of extracted facets (key-value pairs) for filtering.
- `FilterBuilder` — Popover interface for constructing complex log filters.
- `HighlightBuilder` — Popover interface for defining term-based log highlighting.
- `NativeFilePicker` — OS-native file selection via Tauri dialogs.
- `SearchBar` — Main log search input with debouncing and clear button.
- `SourceSelector` — Dropdown/list for picking active log sources.
- `TimeRangePicker` — Absolute and relative time range selection.
- `WorkspaceTabs` — Tab-based navigation for multiple open workspaces.

### Organisms (`src/components/organisms/`)
Complex UI sections composed of molecules and atoms.
- `AIHistorySearchModal` — Searchable index of past AI investigation sessions.
- `AIInvestigationSidebar` — Main chat interface for AI-driven log analysis.
- `CommandPalette` — Global command launcher (⌘K) for fast navigation.
- `CustomParserModal` — Interface for tweaking Drain3 cluster parameters.
- `DiagnosticSidebar` — System health and diagnostic information panel.
- `ExplorerView` — Workspace tree browser (Folders + Sources).
- `FacetSidebar` — Summary of extracted facets across the current log set.
- `FusionConfigEngine` — Configuration for multi-source temporal alignment (Fusion).
- `ImportFeedModal` — Multi-tab dialog (Local / SSH / Manual) for log ingestion.
- `LogDistributionWidget` — Time-series chart of log volume over time.
- `LogToolbar` — Main actions bar: Search, Filter, Highlight, Tail, Export.
- `OrchestratorHub` — Central control for AI strategy and autonomous runs.
- `SettingsPanel` — Comprehensive app settings: AI, Parser, Theme, General.
- `Sidebar` — Main app navigation and workspace switcher.
- `VirtualLogTable` — High-performance virtualized log grid for millions of rows.
- `WorkspaceEngineSettings` — Workspace-specific engine tuning (Retention, etc.).

### Templates (`src/components/templates/`)
Layout wrappers defining the page structure.
- `AppLayout` — Global shell: Sidebar + Main Content Area.
- `InvestigationLayout` — Investigation core: Toolbar + Log Table + Sidebars.

### Pages (`src/components/pages/`)
Specific application views.
- `InvestigationPage` — The primary log analysis environment.
- `SettingsPage` — The application settings view.
- `DashboardPage` — Overview metrics and recent activity (Future module).
