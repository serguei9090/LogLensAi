# LogLensAi – Design System Reference

> **Design Philosophy: "Engine Precision"**  
> A high-contrast, glassmorphic obsidian interface with surgical green and violet accents.
> Every element must feel like part of a professional diagnostic instrument — never a toy.

---

## 1. Color Palette

All hex values are the source of truth. CSS custom properties are defined in `src/styles/globals.css`.

### 1.1 Background & Surface
| CSS Token | Hex | Tailwind Alias | Usage |
|---|---|---|---|
| `--bg-base` | `#0D0F0E` | `bg-[#0D0F0E]` | Global app background, deepest layer |
| `--bg-surface` | `#111613` | `bg-surface` | Panels, sidebars, cards |
| `--bg-surface-bright` | `#1A1F1C` | `bg-surface-bright` | Elevated cards, popovers |
| `--bg-hover` | `#1E2520` | `bg-hover` | Row hovers, interactive surface states |

### 1.2 Borders
| CSS Token | Hex | Usage |
|---|---|---|
| `--border` | `#2A3430` | Primary dividers, card edges |
| `--border-muted` | `#1D2420` | Subtle separators within panels |
| `--border-glow` | `#22C55E4D` (30% α) | Active focus rings, selected state glow |

### 1.3 Primary Brand (Tactical Green)
| CSS Token | Hex | Usage |
|---|---|---|
| `--primary` | `#22C55E` | Primary actions, active states, brand identity |
| `--primary-hover` | `#16A34A` | Hover/pressed state for primary elements |
| `--primary-muted` | `#14532D` | Backgrounds for badges, chips, and indicators |
| `--primary-glow` | `#22C55E33` (20% α) | Shadow glow on prominent green elements |

### 1.4 Orchestrator Accent (Violet)
> **Added in Orchestrator Hub (Sprint S-03)** — distinct from brand green to signal AI orchestration.

| Color | Hex | Tailwind | Usage |
|---|---|---|---|
| Violet Base | `#8B5CF6` | `text-violet-500` | Orchestrate button, fusion tab icon |
| Violet Bg | `#8B5CF610` | `bg-violet-500/10` | Fusion form surface, strategy cards |
| Violet Border | `#8B5CF620` | `border-violet-500/20` | Fusion item borders |
| Violet Active | `#7C3AED` | `bg-violet-600` | Deploy Fusion button |

### 1.5 Semantic Status Colors
| CSS Token | Hex | Text Class | Background Class | Usage |
|---|---|---|---|---|
| `--error` | `#EF4444` | `text-error` | `bg-error-bg` (`#450A0A`) | Errors, critical failures |
| `--warning` | `#F59E0B` | `text-warning` | `bg-warning-bg` (`#451A03`) | Warnings, degraded state |
| `--info` | `#38BDF8` | `text-info` | `bg-info-bg` (`#0C2A3E`) | Informational messages |
| `--debug` | `#A78BFA` | `text-debug` | `bg-debug-bg` (`#1E1333`) | Debug-level log entries |

### 1.6 Text
| CSS Token | Hex | Usage |
|---|---|---|
| `--text-primary` | `#E8F5EC` | Main content, headings |
| `--text-secondary` | `#8FA898` | Supporting information, descriptions |
| `--text-muted` | `#4D6057` | Labels, placeholders, timestamps |
| `--text-inverse` | `#0D0F0E` | Text on primary/green buttons |

### 1.7 Highlight Palette (Log Marking)
| Token | Hex | Usage |
|---|---|---|
| `--highlight-1` | `#FBBF24` | First highlight color (amber) |
| `--highlight-2` | `#60A5FA` | Second highlight color (blue) |
| `--highlight-3` | `#F472B6` | Third highlight color (pink) |

---

## 2. Typography

### Font Families
| Role | Font | CSS Token | Fallback |
|---|---|---|---|
| **Interface / UI** | Inter Variable | `--font-sans` | `system-ui, sans-serif` |
| **Log Content / Code** | JetBrains Mono | `--font-mono` | `monospace` |

Both fonts are self-hosted via `@fontsource-variable/inter` and `@fontsource/jetbrains-mono` — no CDN dependency.

### Type Scale & Weight
| Use Case | Size | Weight | Class |
|---|---|---|---|
| Modal / Page Title | `text-lg` (18px) | 700 Bold | `font-bold` |
| Section Header | `text-sm` (14px) | 600 Semi | `font-semibold` |
| Body / Content | `text-sm` (14px) | 400 | — |
| Label / Uppercase | `text-[10px]` | 700 Bold | `uppercase tracking-widest` |
| Log Entry | `text-xs` (12px) | 400 | `font-mono` |
| Micro / Meta | `text-[9px]` | 600 | `uppercase tracking-wider` |

---

## 3. Shape & Radius

| Token | Value | Applied To |
|---|---|---|
| `--radius-sm` | `4px` | Tooltips, micro badges, line indicators |
| `--radius-md` | `8px` | Standard buttons, input fields, small cards |
| `--radius-lg` | `12px` | Panels, source config rows, filter chips |
| `--radius-xl` | `16px` | Form inputs, primary action buttons |
| `--radius-modal` | `1.5–2rem` | Full modals, drawer containers |

---

## 4. Glassmorphic Standards

These are mandatory for any card/panel that overlays an animated or data-dense backdrop.

| Property | Value |
|---|---|
| **Backdrop Blur** | `backdrop-blur-xl` (20px) |
| **Glass Tint** | `bg-white/[0.03]` — header highlights only |
| **Border** | `border border-white/10` or `border border-border/40` |
| **Primary Shadow** | `shadow-2xl` or `shadow-[0_30px_60px_-15px_rgba(0,0,0,0.8)]` |
| **Glow Shadow** | `shadow-[0_0_12px_rgba(34,197,94,0.2)]` on green primary buttons |

---

## 5. Spacing & Layout

| Zone | Value | Notes |
|---|---|---|
| Modal outer padding | `p-6` (24px) | Consistent across all modals/drawer sections |
| Card inner section | `p-4` (16px) | Source config rows, info banners |
| Toolbar height | `py-2.5` (10px) | Sticky toolbar — do not increase |
| Drawer width | `w-[420px]` | OrchestratorHub fixed width |

---

## 6. Log Level → Visual Mapping (STRICT)

| Level | Text | Background | Badge Bg | Usage |
|---|---|---|---|---|
| `ERROR` / `FATAL` | `text-error` (`#EF4444`) | `bg-error-bg/30` | `bg-red-500/20 text-red-400` | Critical |
| `WARN` / `WARNING` | `text-warning` (`#F59E0B`) | `bg-warning-bg/20` | `bg-amber-500/20 text-amber-400` | Degraded |
| `INFO` | `text-primary` (`#22C55E`) | — | `bg-primary/20 text-primary` | Normal |
| `DEBUG` | `text-debug` (`#A78BFA`) | — | `bg-violet-500/20 text-violet-400` | Verbose |
| `TRACE` | `text-text-muted` | — | `bg-white/5 text-text-muted` | Lowest priority |

---

## 7. Iconography Standards (Lucide React)

To ensure visual consistency and prevent "icon sprawl," use these standardized mappings for all new UI elements.

### 7.1 Semantic Levels
| Level | Icon | Usage |
|---|---|---|
| `ERROR` / `FATAL` | `AlertCircle` | Red indicators, log badges, error toasts |
| `WARN` / `WARNING` | `AlertTriangle` | Amber indicators, degradation warnings |
| `INFO` | `Info` | Information banners, status tooltips |
| `DEBUG` | `Bug` | Debugging logs, technical details |
| `SUCCESS` | `CheckCircle2` | Ingestion success, save confirmation |

### 7.2 Core Actions
| Action | Icon | Usage |
|---|---|---|
| **Search** | `Search` | Main log search, history lookup |
| **Filter** | `Filter` | Filter builder, facet selection |
| **Highlight** | `Highlighter` | Log marking, term highlighting |
| **Live Tail** | `Zap` | Active monitoring, streaming toggle |
| **AI Analysis** | `Sparkles` | Investigation, clustering, insights |
| **Orchestrate** | `Layers` | Fusion config, multi-source alignment |
| **Settings** | `Settings2` | Application / Workspace preferences |
| **Export** | `Download` | CSV/JSON log export |
| **Delete** | `Trash2` | Wipe logs, remove source, delete folder |
| **History** | `History` | AI session browser, past activity |

---

## 8. Component → Token Mapping

| Component | State | Tokens Used |
|---|---|---|
| Primary Button | Default | `bg-primary text-text-inverse font-bold rounded-xl shadow-[0_0_12px_rgba(34,197,94,0.2)]` |
| Primary Button | Hover | `hover:bg-primary-hover` |
| Orchestrate Button | Default | `bg-violet-500/10 text-violet-400 border border-violet-500/20` |
| Orchestrate Button | Hover | `hover:bg-violet-500/20 hover:border-violet-500/40` |
| Fusion Tab | Active | `bg-violet-500/15 text-violet-400 border-violet-500/30` |
| Source Tab | Active | `bg-primary/15 text-primary border-primary/30` |
| Input Field | Default | `bg-black/60 border border-border/40 rounded-xl` |
| Input Field | Focus | `focus:ring-2 focus:ring-primary/40 focus:border-primary/60` |
| Filter Badge | Active | `bg-primary text-bg-base font-black` |
| Sidebar Link | Selected | `bg-primary/10 text-primary` + left border indicator |
| Log Row | ERROR | `text-error font-bold` (level cell only) |
| Log Row Highlight | WARN | `text-warning` |

---

## 8. Portal & Overlay Z-Index Stack

| Layer | Z-Index | Component |
|---|---|---|
| Sticky toolbar | `z-10` | `LogToolbar` |
| Drawer backdrop | `z-[150]` | `OrchestratorHub` |
| Drawer panel | `z-[160]` | `OrchestratorHub` |
| Full-screen modal | `z-[200]` | `CustomParserModal` |
| Timezone popover | `z-[9999]` | `TimezoneSelect` (portal) |

> **Portal Rule**: Any floating element inside `overflow:hidden/auto` ancestors MUST use `createPortal(panel, document.body)` + `getBoundingClientRect()`.

---

## 9. Animation Standards

| Interaction | Class | Notes |
|---|---|---|
| Fade in | `animate-in fade-in duration-200` | Backdrops, toasts |
| Slide from right | `animate-in slide-in-from-right duration-300` | Drawers (OrchestratorHub) |
| Slide from bottom | `animate-in slide-in-from-bottom-4 duration-500` | Page content |
| Zoom in | `animate-in zoom-in-95 duration-200` | Context menus, popover menus |
| Pulse | `animate-pulse` | Loading states, live-tail indicators |

---

## 10. Known Guardrails (Auto-Improved)

> These are non-negotiable rules learned from real bugs in production.

1. **No native `<select>`** — always use custom portal dropdown.
2. **No `flex items-center justify-center` for tall modals** — use `overflow-y-auto py-8 + my-auto`.
3. **Portal backdrop self-close bug** — use `onMouseDown` + 150ms `isReadyRef` mount guard.
4. **Dark theme hex colors** — never hardcode hex in component files — always use CSS custom property.
5. **Text log samples** — limit to 2 representative lines in any "sample viewer" UI.
