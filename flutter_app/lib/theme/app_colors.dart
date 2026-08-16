import "package:flutter/material.dart";

/// Design tokens ported verbatim from `DESIGN.md` (YAML frontmatter) and
/// `src/styles/globals.css` (`@theme` block). LogLensAi is dark-theme-only —
/// there is no light palette per DESIGN.md ("Obsidian Base" aesthetic).
///
/// Keep this file in 1:1 sync with the CSS custom properties; if a token is
/// added/renamed on the React side, mirror it here under the same name
/// (converted to lowerCamelCase).
abstract final class AppColors {
  // ── Primary (Tactical Green) ──────────────────────────────────────────
  static const Color primary = Color(0xFF22C55E);
  static const Color primaryHover = Color(0xFF16A34A);
  static const Color primaryMuted = Color(0xFF14532D);
  static const Color primaryGlow = Color(0x3322C55E); // #22c55e33

  // ── Backgrounds ────────────────────────────────────────────────────────
  static const Color bgBase = Color(0xFF0D0F0E);
  static const Color bgApp = Color(0xFF0A0C0B);
  static const Color bgSidebar = Color(0xFF0A0C0B);
  static const Color bgSurface = Color(0xFF111613);
  static const Color bgSurfaceBright = Color(0xFF1A1F1C);
  static const Color bgHover = Color(0xFF1E2520);
  static const Color bgTooltip = Color(0xFF111312);

  // ── Borders ────────────────────────────────────────────────────────────
  static const Color border = Color(0xFF2A3430);
  static const Color borderMuted = Color(0xFF1D2420);
  static const Color borderSubtle = Color(0xFF1D2420);
  static const Color borderGlow = Color(0x4D22C55E); // #22C55E4D

  // ── Text ───────────────────────────────────────────────────────────────
  static const Color textPrimary = Color(0xFFE8F5EC);
  static const Color textSecondary = Color(0xFF8FA898);
  static const Color textMuted = Color(0xFF4D6057);
  static const Color textInverse = Color(0xFF0D0F0E);

  // ── Log level semantics ───────────────────────────────────────────────
  static const Color error = Color(0xFFEF4444);
  static const Color errorBg = Color(0xFF450A0A);
  static const Color warning = Color(0xFFF59E0B);
  static const Color warningBg = Color(0xFF451A03);
  static const Color info = Color(0xFF38BDF8);
  static const Color infoBg = Color(0xFF0C2A3E);
  static const Color debug = Color(0xFFA78BFA);
  static const Color debugBg = Color(0xFF1E1333);

  // ── AI / accent ────────────────────────────────────────────────────────
  static const Color accentViolet = Color(0xFF8B5CF6);
  static const Color accentVioletBg = Color(0x108B5CF6); // #8B5CF610

  // ── Highlights (search-term highlighting) ────────────────────────────
  static const Color highlight1 = Color(0xFFFBBF24);
  static const Color highlight2 = Color(0xFF60A5FA);
  static const Color highlight3 = Color(0xFFF472B6);
  // Added for HighlightBuilder's 6-swatch preset palette (mirrors React's
  // PRESET_COLORS: Amber/Blue/Pink/Emerald/Orange/Purple -- Purple reuses
  // [debug] below since it's already the same #A78BFA).
  static const Color highlight4 = Color(0xFF34D399); // Emerald
  static const Color highlight5 = Color(0xFFFB923C); // Orange

  // ── Misc ───────────────────────────────────────────────────────────────
  static const Color scrollbar = Color(0xFF2A3430);

  /// Returns the semantic color for a log level string (case-insensitive).
  /// Mirrors the ERROR/WARN/INFO/DEBUG mapping in DESIGN.md; FATAL/CRITICAL
  /// fold into `error`, TRACE/VERBOSE fold into `debug`, anything unknown
  /// falls back to [textSecondary].
  static Color forLogLevel(String level) {
    switch (level.toUpperCase()) {
      case "ERROR":
      case "FATAL":
      case "CRITICAL":
        return error;
      case "WARN":
      case "WARNING":
        return warning;
      case "INFO":
        return info;
      case "DEBUG":
      case "TRACE":
      case "VERBOSE":
        return debug;
      default:
        return textSecondary;
    }
  }

  /// Returns the semantic background color for a log level string.
  static Color bgForLogLevel(String level) {
    switch (level.toUpperCase()) {
      case "ERROR":
      case "FATAL":
      case "CRITICAL":
        return errorBg;
      case "WARN":
      case "WARNING":
        return warningBg;
      case "INFO":
        return infoBg;
      case "DEBUG":
      case "TRACE":
      case "VERBOSE":
        return debugBg;
      default:
        return bgSurface;
    }
  }
}
