import "package:flutter/material.dart";

import "app_colors.dart";

/// Typography ported from DESIGN.md `tokens.typography`.
///
/// - `sans` (Inter Variable) is used for all UI chrome/labels.
/// - `mono` (JetBrains Mono) is used for ALL log/raw data per DESIGN.md's
///   "DO use JetBrains Mono for any raw data strings" rule.
///
/// Font family is referenced by name with a system fallback rather than
/// via the `google_fonts` package or vendored binaries: the repo only
/// ships `.woff`/`.woff2` (web-only formats Flutter's asset font loader
/// can't consume), and `google_fonts`' runtime-fetch behavior is
/// network-dependent, which makes `flutter test`/CI flaky offline.
/// Follow-up: bundle real `Inter-*.ttf` / `JetBrainsMono-*.ttf` assets
/// under `assets/fonts/` and register them in `pubspec.yaml`'s
/// `flutter.fonts` section for pixel-accurate rendering; until then this
/// renders with each platform's closest installed sans/mono font.
abstract final class AppTypography {
  static const String sansFamily = "Inter";
  static const String monoFamily = "JetBrains Mono";

  static const List<String> _sansFallback = [
    "Segoe UI",
    "Roboto",
    "Helvetica Neue",
    "system-ui",
    "sans-serif",
  ];

  static const List<String> _monoFallback = [
    "Cascadia Mono",
    "Consolas",
    "Courier New",
    "monospace",
  ];

  static TextStyle _sans({
    required double fontSize,
    required FontWeight fontWeight,
    required double height,
    Color color = AppColors.textPrimary,
    double? letterSpacing,
  }) {
    return TextStyle(
      fontFamily: sansFamily,
      fontFamilyFallback: _sansFallback,
      fontSize: fontSize,
      fontWeight: fontWeight,
      height: height / fontSize,
      color: color,
      letterSpacing: letterSpacing,
    );
  }

  static TextStyle _mono({
    required double fontSize,
    required FontWeight fontWeight,
    required double height,
    Color color = AppColors.textPrimary,
  }) {
    return TextStyle(
      fontFamily: monoFamily,
      fontFamilyFallback: _monoFallback,
      fontSize: fontSize,
      fontWeight: fontWeight,
      height: height / fontSize,
      color: color,
    );
  }

  /// h1: 18px / 700 / lh 24px
  static TextStyle get h1 =>
      _sans(fontSize: 18, fontWeight: FontWeight.w700, height: 24);

  /// h2: 14px / 600 / lh 20px
  static TextStyle get h2 =>
      _sans(fontSize: 14, fontWeight: FontWeight.w600, height: 20);

  /// body: 14px / 400 / lh 20px (base body size for the whole app)
  static TextStyle get body =>
      _sans(fontSize: 14, fontWeight: FontWeight.w400, height: 20);

  /// label-caps: 10px / 700 / uppercase / letter-spacing 0.1em
  /// Caller is responsible for `.toUpperCase()`-ing the text itself.
  static TextStyle get labelCaps => _sans(
    fontSize: 10,
    fontWeight: FontWeight.w700,
    height: 14,
    letterSpacing: 1.0, // 0.1em @ 10px
    color: AppColors.textSecondary,
  );

  /// log: 12px / 400 / lh 16px, JetBrains Mono — for raw log lines.
  static TextStyle get log =>
      _mono(fontSize: 12, fontWeight: FontWeight.w400, height: 16);

  /// Convenience: JetBrains Mono at body size, for inline code/data outside
  /// the log table (e.g. paths, IDs, hashes).
  static TextStyle get monoBody =>
      _mono(fontSize: 14, fontWeight: FontWeight.w400, height: 20);
}
