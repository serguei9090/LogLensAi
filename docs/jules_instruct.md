# LogLensAi — Jules Implementation Prompt

> **Usage**: Copy the prompt below verbatim into Jules CLI.
> Context files to attach: `docs/track/TODO.md`, `docs/design/theme.md`, `docs/design/ui-components.md`, `AGENTS.md`

---

## Prompt

You are implementing **LogLensAi**, a Tauri v2 desktop application for log analysis.

**Stack**: React 19 + TypeScript, Vite, Zustand, TanStack Virtual, shadcn/ui, Tailwind CSS (via shadcn tokens), Python sidecar (DuckDB, Drain3, aiohttp).

**Your task is Sprint 01** of the project. Complete ALL items marked `[ ]` in `docs/track/TODO.md` under the "Sprint 01" section. Do not touch backlog items.

---

### CRITICAL RULES

1. **Never break the JSON-RPC interface.** All frontend↔sidecar communication is via `useSidecarBridge.ts`. Do not change the transport layer.
2. **Atomic Design is mandatory.** All components go under the correct layer:
   - `src/components/atoms/`, `molecules/`, `organisms/`, `templates/`, `pages/`
   - See `docs/design/ui-components.md` for the full mapping.
3. **Use only design tokens.** All colors, spacing, and typography must come from CSS variables defined in `src/styles/globals.css` (see `docs/design/theme.md`). No hardcoded hex values in component files.
4. **Thread-safe DuckDB.** Every query in `sidecar/src/api.py` must call `self.db.get_cursor()` (returns `conn.cursor()`), NOT `get_connection()`. This prevents "No open result set" errors caused by concurrent threads.
5. **Sidecar cleanup must be async.** The `on_cleanup` handler in `api.py` must be `async def`.

---

### Step-by-Step Implementation Order

#### Step 1 — Global Styles (`src/styles/globals.css`)
- Define all CSS custom properties from `docs/design/theme.md`
- Import Inter from Google Fonts and JetBrains Mono
- Apply `--bg-base` to `:root body`

#### Step 2 — shadcn Components (`src/components/ui/`)
Install via `bunx shadcn@latest add`:
`button input label switch badge tooltip dialog popover select separator scroll-area tabs card dropdown-menu table skeleton sonner`

Customize each component's default CSS to use the design tokens.

#### Step 3 — Atoms
Implement exactly these atoms:
- `LogLevelBadge` — Props: `level: "ERROR"|"WARN"|"INFO"|"DEBUG"|"TRACE"`. Renders a `Badge` using the level color token.
- `StatusDot` — Props: `active: boolean`. A pulsing circle using `--primary` when active, `--border` when not.
- `TailSwitch` — Props: `checked: boolean, onCheckedChange: (v: boolean) => void`. Labeled switch.
- `HelpTooltip` — Props: `content: string`. A `?` icon that shows a Tooltip.
- `IconButton` — Props: `icon: ReactNode, label: string, onClick: () => void`. Ghost-variant button.

#### Step 4 — Molecules
Build each molecule as described in `docs/design/ui-components.md`.

**FilterBuilder** — critical design:
- A `Popover` that opens a form for each filter entry
- Each filter: `{ id, field, operator, value }`
- Fields: `level` | `source_id` | `cluster_id` | `raw_text`
- Operators: `=` | `!=` | `contains` | `not_contains` | `starts_with`
- Multi-filter: all conditions are AND-joined server-side
- Each filter shows as a `FilterTag` chip with a remove button
- "Clear All" button

**HighlightBuilder** — critical design:
- A `Popover` listing active highlight rules
- Each rule: `{ id, term, color }` where color is from a preset palette
- Preset colors: `#FBBF24`, `#60A5FA`, `#F472B6`, `#34D399`, `#FB923C`
- Each rule shows as a `HighlightTag` chip
- Text matching is case-insensitive, applied client-side to rendered log line text

#### Step 5 — Organisms

**LogToolbar** (`src/components/organisms/LogToolbar.tsx`)
- Layout: `[SearchBar] [FilterBuilder] [HighlightBuilder] [TailSwitch] [StatusDot]`
- All in a single sticky bar at top of investigation view
- Props: `onSearch, activeFilters, onFilterChange, activeHighlights, onHighlightChange, isTailing, onTailToggle, status`

**VirtualLogTable** (`src/components/organisms/VirtualLogTable.tsx`)
- Use TanStack Virtual for row virtualization
- Columns: `#` (row index) | `Timestamp` | `Level` | `Message` | `Cluster`
- Row background set from level color token
- Message cell: render highlight matches with `<mark>` styled with highlight color
- Click row → show expanded raw text in a slide-out panel below the row

**ImportFeedModal** (`src/components/organisms/ImportFeedModal.tsx`)
- `Dialog` with `Tabs`: Local | SSH | Manual
- Each tab has a `TailSwitch` labeled "Live Tail" (default ON)
- Local tab: path input + browse button (calls Tauri `open` dialog) + TailSwitch + Submit → `start_tail` RPC
- SSH tab: host/port/user/pass+path inputs + TailSwitch + Submit → `start_ssh_tail` RPC
- Manual tab: textarea + "Ingest" button → `ingest_logs` RPC (no tail switch, one-time)

**SettingsPanel** (`src/components/organisms/SettingsPanel.tsx`)
- Full-page settings, not a modal
- Three `Card` sections:
  1. **AI Provider**: Select (gemini-cli / openai / anthropic) + API key `Input` (type=password)
  2. **Drain3**: similarity_threshold (number input 0-1) + max_children (number) + max_clusters (number); each with a `HelpTooltip`
  3. **General**: row height select (compact/default/comfortable) + font size (select 12/13/14/15/16px)
- Save button: calls `update_settings` RPC with all values as key/value pairs

**Sidebar** (`src/components/organisms/Sidebar.tsx`)
- Fixed left sidebar
- App logo / name at top
- Section: "Workspaces" — list of workspace items; "+" button to create new; each item: name + click to switch + right-click to rename/delete
- Section divider
- "Investigation" nav item (active = primary color)
- "Settings" nav item
- "Dashboard" nav item (grayed out, `cursor-not-allowed`, tooltip: "Coming soon")

#### Step 6 — Templates & Pages
- `AppLayout`: `<Sidebar /> + <main>{children}</main>`
- `InvestigationPage`: `<ImportFeedModal /> + <LogToolbar /> + <VirtualLogTable />`
- `SettingsPage`: `<SettingsPanel />`

#### Step 7 — Zustand Stores

**`workspaceStore.ts`**:
```ts
interface Workspace {
  id: string;
  name: string;
  sourceType: 'local' | 'ssh' | 'manual';
  sourcePath: string | null;
  createdAt: Date;
}
interface WorkspaceStore {
  workspaces: Workspace[];
  activeWorkspaceId: string;
  setActive: (id: string) => void;
  addWorkspace: (ws: Omit<Workspace, 'createdAt'>) => void;
  removeWorkspace: (id: string) => void;
  renameWorkspace: (id: string, name: string) => void;
}
```

**`investigationStore.ts`**:
```ts
interface InvestigationStore {
  searchQuery: string;
  filters: Filter[];
  highlights: Highlight[];
  logs: LogEntry[];
  total: number;
  offset: number;
  isTailing: boolean;
  setSearchQuery: (q: string) => void;
  setFilters: (f: Filter[]) => void;
  setHighlights: (h: Highlight[]) => void;
  setLogs: (logs: LogEntry[], total: number) => void;
  setTailing: (v: boolean) => void;
}
```

#### Step 8 — Sidecar Fixes (`sidecar/src/`)
- `db.py`: rename `get_connection()` → `get_cursor()` returning `self.conn.cursor()`
- `api.py`: replace ALL `self.db.get_connection()` → `self.db.get_cursor()`
- `api.py` `on_cleanup`: ensure it is `async def`
- `api.py` `method_is_tailing`: implement as described in `docs/track/TODO.md` INV-004
- `api.py` `method_stop_tail`: fix to use `os.path.abspath` and correct tail key format

#### Step 9 — Gemini CLI AI Integration (`sidecar/src/ai.py`)
- Method: `analyze_cluster(cluster_id, workspace_id) -> dict`
- Fetch cluster template + last 20 log samples from DuckDB
- Build prompt: "You are a log analyst. Analyze this log cluster and return ONLY a JSON object with keys: summary, root_cause, recommended_actions (array of strings). Cluster template: {template}. Sample logs:\n{samples}"
- Execute: `subprocess.run(["gemini", "-p", prompt, "--json"], capture_output=True, text=True, timeout=30)`
- Parse stdout as JSON, return dict
- If error or parse fails, return `{"summary": "Analysis failed", "root_cause": str(e), "recommended_actions": []}`
- Expose as RPC: `analyze_cluster`

---

### Acceptance Criteria
- `bun run dev:all` starts without errors
- Opening the app shows the sidebar with one default workspace
- Clicking "Import" opens the modal; importing a local `.log` file works
- After import, the log table shows entries with correct level coloring
- The TailSwitch in the toolbar toggles tailing ON/OFF
- Filter builder allows adding/removing multiple filters
- Highlight builder colors matching terms in the log view
- Settings page saves Drain3 config correctly
- No DuckDB "No open result set" errors in the console
