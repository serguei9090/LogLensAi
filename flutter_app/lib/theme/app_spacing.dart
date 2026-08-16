/// Spacing scale ported from DESIGN.md `tokens.spacing`
/// (xs=4, sm=8, md=16, lg=24, xl=32 — note DESIGN.md expresses these in rem
/// at a 16px root, i.e. 0.25rem/0.5rem/1rem/1.5rem/2rem). `gap` is the
/// standard inter-block gap used throughout the layout (`gap-4` in Tailwind
/// == 16px == [md]).
abstract final class AppSpacing {
  static const double xs = 4;
  static const double sm = 8;
  static const double md = 16;
  static const double lg = 24;
  static const double xl = 32;

  /// Standard gap between layout blocks (DESIGN.md "Layout" section).
  static const double gap = 16;
}

/// Border radius scale ported from DESIGN.md `tokens.rounded`.
abstract final class AppRadius {
  static const double sm = 4;
  static const double md = 8; // buttons / inputs
  static const double lg = 12; // cards / rows
  static const double xl = 16;
  static const double modal = 24; // 1.5rem
}
