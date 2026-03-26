# LogLensAi - Design System & Theme

## Color Palette

> Dark base with vibrant green accents. All UI must use these tokens exclusively.

| Label | Hex | Usage |
|---|---|---|
| `--bg-base` | `#0D0F0E` | App root background |
| `--bg-surface` | `#111613` | Cards, panels, sidebars |
| `--bg-surface-bright` | `#1A1F1C` | Elevated surfaces, modals |
| `--bg-hover` | `#1E2520` | Hover state background |
| `--border` | `#2A3430` | Dividers, borders |
| `--border-muted` | `#1D2420` | Subtle separators |
| `--primary` | `#22C55E` | Primary CTA, active states, tail-on indicator |
| `--primary-hover` | `#16A34A` | Hover on primary |
| `--primary-muted` | `#14532D` | Soft primary backgrounds, badges |
| `--primary-glow` | `#22C55E33` | Glow/shadow on active items |
| `--text-primary` | `#E8F5EC` | Main body text |
| `--text-secondary` | `#8FA898` | Labels, secondary copy |
| `--text-muted` | `#4D6057` | Placeholder text, disabled |
| `--text-inverse` | `#0D0F0E` | Text on primary buttons |
| `--error` | `#EF4444` | Error badge, error log level |
| `--error-bg` | `#450A0A` | Error row background tint |
| `--warning` | `#F59E0B` | Warning badge, warn log level |
| `--warning-bg` | `#451A03` | Warning row background tint |
| `--info` | `#38BDF8` | Info badge, info log level |
| `--info-bg` | `#0C2A3E` | Info row background tint |
| `--debug` | `#A78BFA` | Debug badge, debug log level |
| `--debug-bg` | `#1E1333` | Debug row background tint |
| `--success` | `#22C55E` | (same as primary) Success states |
| `--highlight-1` | `#FBBF24` | First highlight color |
| `--highlight-2` | `#60A5FA` | Second highlight color |
| `--highlight-3` | `#F472B6` | Third highlight color |
| `--scrollbar` | `#2A3430` | Scrollbar track/thumb |

## Typography

- **Font Family**: `"Inter", system-ui, sans-serif` (via Google Fonts)
- **Mono Font**: `"JetBrains Mono", monospace` (for log lines)
- **Base Size**: `14px`
- **Log Line Size**: `13px`

## Radius & Spacing

| Token | Value | Usage |
|---|---|---|
| `--radius-sm` | `4px` | Badges, tags |
| `--radius-md` | `8px` | Inputs, buttons |
| `--radius-lg` | `12px` | Cards, panels |
| `--radius-xl` | `16px` | Modals |
| `--spacing-unit` | `4px` | Base spacing multiplier |

## Component-Level Color Mapping

| Component | Background | Border | Text | Accent |
|---|---|---|---|---|
| Sidebar | `--bg-surface` | `--border-muted` | `--text-primary` | `--primary` |
| Log Row (default) | `transparent` | none | `--text-primary` | — |
| Log Row (ERROR) | `--error-bg` | `--error` | `--text-primary` | `--error` |
| Log Row (WARN) | `--warning-bg` | `--warning` | `--text-primary` | `--warning` |
| Log Row (INFO) | transparent | none | `--info` | `--info` |
| Log Row (DEBUG) | transparent | none | `--debug` | `--debug` |
| Log Row (highlighted) | `--primary-muted` | `--primary` | `--text-primary` | `--primary` |
| Filter Badge | `--primary-muted` | `--primary` | `--primary` | — |
| Button (primary) | `--primary` | none | `--text-inverse` | `--primary-hover` |
| Button (ghost) | transparent | `--border` | `--text-secondary` | `--bg-hover` |
| Button (danger) | `--error-bg` | `--error` | `--error` | — |
| Input | `--bg-surface-bright` | `--border` | `--text-primary` | `--primary` |
| Switch (on) | `--primary` | — | — | `--primary-glow` |
| Switch (off) | `--border` | — | — | — |
| Tooltip | `--bg-surface-bright` | `--border` | `--text-primary` | — |
| Modal | `--bg-surface` | `--border` | `--text-primary` | — |
| Settings Card | `--bg-surface-bright` | `--border-muted` | `--text-primary` | — |
