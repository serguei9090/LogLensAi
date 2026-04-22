---
version: alpha
name: LogLensAi
description: Professional log analysis dashboard with glassmorphic obsidian aesthetics and tactical green accents.
tokens:
  colors:
    primary: "#22C55E"
    primary-hover: "#16A34A"
    primary-muted: "#14532D"
    bg-base: "#0D0F0E"
    bg-surface: "#111613"
    bg-surface-bright: "#1A1F1C"
    bg-hover: "#1E2520"
    border: "#2A3430"
    border-muted: "#1D2420"
    border-glow: "#22C55E4D"
    error: "#EF4444"
    warning: "#F59E0B"
    info: "#38BDF8"
    debug: "#A78BFA"
    text-primary: "#E8F5EC"
    text-secondary: "#8FA898"
    text-muted: "#4D6057"
    text-inverse: "#0D0F0E"
    accent-violet: "#8B5CF6"
    accent-violet-bg: "#8B5CF610"
  typography:
    sans: "Inter Variable, system-ui, sans-serif"
    mono: "JetBrains Mono, monospace"
    h1:
      fontSize: "1.125rem"
      fontWeight: 700
      lineHeight: "1.5rem"
    h2:
      fontSize: "0.875rem"
      fontWeight: 600
      lineHeight: "1.25rem"
    body:
      fontSize: "0.875rem"
      fontWeight: 400
      lineHeight: "1.25rem"
    label-caps:
      fontSize: "0.625rem"
      fontWeight: 700
      letterSpacing: "0.1em"
      textTransform: "uppercase"
    log:
      fontSize: "0.75rem"
      fontWeight: 400
      lineHeight: "1rem"
  rounded:
    sm: "4px"
    md: "8px"
    lg: "12px"
    xl: "16px"
    modal: "1.5rem"
  spacing:
    xs: "0.25rem"
    sm: "0.5rem"
    md: "1rem"
    lg: "1.5rem"
    xl: "2rem"
---

# LogLensAi Design Specification

## Overview
LogLensAi is designed with an **"Engine Precision"** philosophy. The interface should feel like a professional diagnostic instrument — high-contrast, obsidian-based, and glassmorphic. It avoids generic UI tropes in favor of a tactical, dark-mode aesthetic that reduces eye strain during long-tail log analysis sessions.

### Core Principles
- **Surgical Precision**: Every border, icon, and alignment must be intentional.
- **Glassmorphism**: Use layering and backdrop blurs to establish depth without losing the obsidian base.
- **Color Discipline**: Color is used strictly for semantic meaning (Log Levels) or tactical focus (Primary Actions).

## Colors
The color palette is built on an **Obsidian Base** (`#0D0F0E`) with **Tactical Green** (`#22C55E`) as the primary action and brand color.

- **Backgrounds**: Use `bg-base` for the main shell and `bg-surface` for nested panels.
- **Accents**: Use Violet for AI-orchestration features to distinguish them from standard log management.
- **Semantics**: Log levels follow a strict mapping: 
    - `ERROR`: Red (`#EF4444`)
    - `WARN`: Amber (`#F59E0B`)
    - `INFO`: Primary Green (`#22C55E`)
    - `DEBUG`: Violet (`#A78BFA`)

## Typography
Typography is split between **Inter** (for UI controls) and **JetBrains Mono** (for log data).

- **UI Elements**: Use `text-sm` for labels and content.
- **Hierarchy**: Use `uppercase tracking-widest` for section labels to maintain a technical look.
- **Log Data**: Must always use `font-mono` at `text-xs` to maximize horizontal space and readability of structured text.

## Layout
The layout follows a **Fixed-Shell** pattern.
- **Sidebar**: Fixed navigation on the left.
- **Log Table**: Virtualized viewport taking up the majority of the screen.
- **Drawers**: Right-aligned panels for AI Orchestration and Source Configuration.
- **Gaps**: Use `gap-4` (1rem) as the standard spacing between layout blocks.

## Elevation & Depth
Depth is communicated through **Glassmorphic Overlays** rather than traditional shadows.
- **Surface Elevation**: Elevated panels should use `backdrop-blur-xl` with a subtle white tint (`bg-white/[0.03]`).
- **Glows**: Primary buttons and active states use subtle color glows (`shadow-primary-glow`) rather than black shadows to simulate a lit instrument panel.

## Shapes
Shapes are generally **Geometric with Softened Corners**.
- **Standard Radius**: `rounded-md` (8px) for buttons and inputs.
- **Container Radius**: `rounded-lg` (12px) for cards and rows.
- **Modal Radius**: `rounded-modal` (1.5rem) for main interaction containers.

## Components
### Atoms
- **Badges**: Use `bg-opacity-20` of the semantic color for backgrounds to keep them readable against dark surfaces.
- **Buttons**: Primary buttons should feel "Tactical" — bold text, primary green background, and a subtle glow.

### Molecules
- **Log Toolbar**: Sticky, high-contrast bar with micro-interactive filter chips.
- **Workspace Tabs**: Selected tabs use a bottom-border glow to indicate focus.

### Organisms
- **Virtual Log Table**: High-density list with alternating row hovers for better tracking.

## Do's and Don'ts
- **DO** use `border-white/10` for subtle separation.
- **DO** use `JetBrains Mono` for any raw data strings.
- **DON'T** use hard-coded hex colors in components; always reference the CSS variables.
- **DON'T** use generic blue or rounded-full buttons unless they are micro-interactions.
