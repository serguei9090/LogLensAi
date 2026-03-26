# LogLensAi - UI Components Registry

> All UI primitives must be installed from **shadcn/ui** and styled with the project theme tokens.
> Run `bunx shadcn@latest add <component>` for each.

## Required shadcn Components

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
| Command | `command` | Future: Command palette (⌘K) |

## Component → Atomic Layer Mapping

### Atoms (`src/components/atoms/`)
- `LogLevelBadge` — wraps `Badge`, applies level color
- `StatusDot` — Green/amber pulsing dot
- `TailSwitch` — wraps `Switch` with label
- `HelpTooltip` — wraps `Tooltip` with `?` icon trigger
- `IconButton` — wraps `Button` variant="ghost" with icon only

### Molecules (`src/components/molecules/`)
- `SearchBar` — `Input` + `Search` icon + debounce logic
- `FilterTag` — single filter entry (field + operator + value) with remove `×`
- `HighlightTag` — single highlight entry (term + color dot) with remove `×`
- `FilterBuilder` — popover with list of `FilterTag` + "Add Filter" button
- `HighlightBuilder` — popover with list of `HighlightTag` + "Add Highlight" button
- `WorkspaceItem` — sidebar list item for a workspace

### Organisms (`src/components/organisms/`)
- `LogToolbar` — SearchBar + FilterBuilder + HighlightBuilder + TailSwitch
- `VirtualLogTable` — Full virtualized log grid (TanStack Virtual + Table)
- `ImportFeedModal` — Dialog with tabs: Local / SSH / Manual paste
- `Sidebar` — App nav: Workspaces list + Settings link
- `SettingsPanel` — Full settings page: AI Provider + Drain3 + General

### Templates (`src/components/templates/`)
- `AppLayout` — Two-column: Sidebar + main content slot
- `InvestigationLayout` — LogToolbar + VirtualLogTable

### Pages (`src/components/pages/`)
- `InvestigationPage` — Assembled investigation view for a workspace
- `SettingsPage` — Full settings page
- `DashboardPage` — **Placeholder only** (disabled, future module)
