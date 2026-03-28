# LogLensAi - Design System & Theme

## Master Design Philosophy: "Engine Precision"
> High-contrast, glassmorphic obsidian interface with tactical green accents. Every pixel must feel like part of a professional diagnostic tool.

## Color Palette

| Label | Hex | Usage |
|---|---|---|
| `--bg-base` | `#0D0F0E` | App deep background |
| `--bg-surface` | `#111613` | Panels, sidebars (main) |
| `--bg-glass` | `#11161399` | Glassmorphic cards (60% opacity) |
| `--bg-hover` | `#1E2520` | Hover state background |
| `--border` | `#2A3430` | Main boundaries, dividers |
| `--border-glow` | `#22C55E4D` | Subtle glow border on active focus |
| `--primary` | `#22C55E` | Brand Green (Vibrant) |
| `--primary-hover` | `#16A34A` | Interaction highlight |
| `--primary-muted` | `#14532D` | Background for marks and badges |
| `--text-primary` | `#E8F5EC` | Primary reading text |
| `--text-muted` | `#4D6057` | Metadata, placeholders |
| `--error` | `#EF4444` | Critical failure states |
| `--warning` | `#F59E0B` | Cautionary warnings |
| `--info` | `#38BDF8` | System information |

## Typography

- **Interface Font**: `Inter` (Sans-serif) - Tracking `-0.01em` for precision look.
- **Log Engine Font**: `JetBrains Mono` (Monospace) - Optimized for long debugging blocks.
- **Header Weight**: `900` (Black) for primary labels, `700` (Bold) for secondary.

## Radius & Spacing (Premium Layer)

| Token | Value | Applied To |
|---|---|---|
| `--radius-modal` | `2rem (32px)` | Main functional modals and overlays |
| `--radius-card` | `1.5rem (24px)` | Page sections and large containers |
| `--radius-input` | `1rem (16px)` | Form fields, primary buttons, tabs |
| `--radius-atom` | `0.5rem (8px)` | Tooltips, small badges |
| `--padding-mod` | `2.5rem (40px)` | Internal modal padding for high-signal content |

## Glassmorphic Standards
- **Backdrop Blur**: `backdrop-blur-xl` or `20px`.
- **Surface Filter**: Overlay `bg-white/[0.03]` on headers to differentiate from body.
- **Shadow Signature**: `shadow-[0_30px_60px_-15px_rgba(0,0,0,0.8)]` for active dialogs.

## Log Highlighting Protocol
- **Row Highlight**: STRONGLY DISCOURAGED. Row background noise obscures data.
- **Word Highlight (Standard)**: 
  - Use `<mark>` with `bg-primary/20`, `text-primary`, and `border-primary/30`.
  - Border radius: `2px`.
  - Padding: `0 4px`.

## Component → Design Sync

| Component | State | Style Tokens |
|---|---|---|
| Filter Badge | Active | `bg-primary`, `text-bg-base`, `font-black` |
| Import Tab | Active | `bg-primary`, `shadow-xl`, `shadow-primary/20` |
| Input Field | Focus | `border-primary`, `ring-2`, `ring-primary/20` |
| Sidebar Link | Selected | `bg-primary/10`, `text-primary`, `left-border-indicator` |
| Log Row | ERROR | `text-error`, `font-bold` for level, `bg-error/5` |

