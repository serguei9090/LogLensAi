import "package:flutter/material.dart";

import "app_colors.dart";
import "app_spacing.dart";
import "app_typography.dart";

export "app_colors.dart";
export "app_spacing.dart";
export "app_typography.dart";

/// A [ThemeExtension] carrying the LogLensAi-specific tokens that don't map
/// cleanly onto stock [ThemeData] fields (glow decorations, glassmorphic
/// surface treatment, log-level semantic colors). Access via
/// `Theme.of(context).extension<LogLensTheme>()!`.
@immutable
class LogLensTheme extends ThemeExtension<LogLensTheme> {
  const LogLensTheme({
    required this.primaryGlowShadow,
    required this.glassSurfaceDecoration,
  });

  /// DESIGN.md: "Primary buttons and active states use subtle color glows
  /// (`shadow-primary-glow`) rather than black shadows to simulate a lit
  /// instrument panel." No drop shadows anywhere else in the app.
  final List<BoxShadow> primaryGlowShadow;

  /// DESIGN.md: "Elevated panels should use `backdrop-blur-xl` with a
  /// subtle white tint (`bg-white/[0.03]`)." `BackdropFilter` supplies the
  /// blur separately (it can't live in a static decoration); this covers
  /// the translucent tint + border half of the glass effect.
  final BoxDecoration glassSurfaceDecoration;

  static const LogLensTheme dark = LogLensTheme(
    primaryGlowShadow: [
      BoxShadow(color: AppColors.primaryGlow, blurRadius: 24, spreadRadius: 0),
    ],
    glassSurfaceDecoration: BoxDecoration(
      color: Color(0x08FFFFFF), // white @ 3%
      border: Border.fromBorderSide(BorderSide(color: AppColors.border)),
      borderRadius: BorderRadius.all(Radius.circular(AppRadius.lg)),
    ),
  );

  @override
  LogLensTheme copyWith({
    List<BoxShadow>? primaryGlowShadow,
    BoxDecoration? glassSurfaceDecoration,
  }) {
    return LogLensTheme(
      primaryGlowShadow: primaryGlowShadow ?? this.primaryGlowShadow,
      glassSurfaceDecoration: glassSurfaceDecoration ?? this.glassSurfaceDecoration,
    );
  }

  @override
  LogLensTheme lerp(ThemeExtension<LogLensTheme>? other, double t) {
    if (other is! LogLensTheme) return this;
    return t < 0.5 ? this : other;
  }
}

/// Builds the single (dark-only) [ThemeData] for the app. LogLensAi has no
/// light mode per DESIGN.md's "Obsidian Base" aesthetic.
abstract final class AppTheme {
  static ThemeData get dark {
    final colorScheme = const ColorScheme.dark(
      surface: AppColors.bgSurface,
      onSurface: AppColors.textPrimary,
      primary: AppColors.primary,
      onPrimary: AppColors.textInverse,
      secondary: AppColors.accentViolet,
      onSecondary: AppColors.textPrimary,
      error: AppColors.error,
      onError: AppColors.textInverse,
      outline: AppColors.border,
      outlineVariant: AppColors.borderMuted,
    );

    return ThemeData(
      useMaterial3: true,
      brightness: Brightness.dark,
      colorScheme: colorScheme,
      scaffoldBackgroundColor: AppColors.bgBase,
      canvasColor: AppColors.bgBase,
      fontFamily: AppTypography.body.fontFamily,
      textTheme: TextTheme(
        headlineSmall: AppTypography.h1,
        titleMedium: AppTypography.h2,
        bodyMedium: AppTypography.body,
        labelSmall: AppTypography.labelCaps,
      ),
      splashFactory: NoSplash.splashFactory,
      // DESIGN.md: no drop shadows anywhere — flatten Material's defaults.
      shadowColor: Colors.transparent,
      appBarTheme: const AppBarTheme(
        backgroundColor: AppColors.bgSidebar,
        foregroundColor: AppColors.textPrimary,
        elevation: 0,
        scrolledUnderElevation: 0,
        surfaceTintColor: Colors.transparent,
      ),
      cardTheme: CardThemeData(
        color: AppColors.bgSurfaceBright,
        elevation: 0,
        margin: EdgeInsets.zero,
        shape: RoundedRectangleBorder(
          borderRadius: BorderRadius.circular(AppRadius.lg),
          side: const BorderSide(color: AppColors.border),
        ),
      ),
      dividerTheme: const DividerThemeData(
        color: AppColors.border,
        thickness: 1,
        space: 1,
      ),
      elevatedButtonTheme: ElevatedButtonThemeData(
        style: ElevatedButton.styleFrom(
          backgroundColor: AppColors.primary,
          foregroundColor: AppColors.textInverse,
          disabledBackgroundColor: AppColors.primaryMuted,
          elevation: 0,
          shadowColor: Colors.transparent,
          textStyle: AppTypography.body.copyWith(fontWeight: FontWeight.w700),
          shape: RoundedRectangleBorder(
            borderRadius: BorderRadius.circular(AppRadius.md),
          ),
          padding: const EdgeInsets.symmetric(
            horizontal: AppSpacing.md,
            vertical: AppSpacing.sm,
          ),
        ),
      ),
      outlinedButtonTheme: OutlinedButtonThemeData(
        style: OutlinedButton.styleFrom(
          foregroundColor: AppColors.textPrimary,
          side: const BorderSide(color: AppColors.border),
          shape: RoundedRectangleBorder(
            borderRadius: BorderRadius.circular(AppRadius.md),
          ),
        ),
      ),
      inputDecorationTheme: InputDecorationTheme(
        filled: true,
        fillColor: AppColors.bgSurface,
        hintStyle: AppTypography.body.copyWith(color: AppColors.textMuted),
        border: OutlineInputBorder(
          borderRadius: BorderRadius.circular(AppRadius.md),
          borderSide: const BorderSide(color: AppColors.border),
        ),
        enabledBorder: OutlineInputBorder(
          borderRadius: BorderRadius.circular(AppRadius.md),
          borderSide: const BorderSide(color: AppColors.border),
        ),
        focusedBorder: OutlineInputBorder(
          borderRadius: BorderRadius.circular(AppRadius.md),
          borderSide: const BorderSide(color: AppColors.primary),
        ),
      ),
      tooltipTheme: TooltipThemeData(
        decoration: BoxDecoration(
          color: AppColors.bgTooltip,
          borderRadius: BorderRadius.circular(AppRadius.sm),
          border: Border.all(color: AppColors.border),
        ),
        textStyle: AppTypography.body.copyWith(fontSize: 12),
      ),
      scrollbarTheme: ScrollbarThemeData(
        thumbColor: WidgetStateProperty.all(AppColors.scrollbar),
        radius: const Radius.circular(3),
        thickness: WidgetStateProperty.all(6),
      ),
      navigationRailTheme: const NavigationRailThemeData(
        backgroundColor: AppColors.bgSidebar,
        indicatorColor: AppColors.bgHover,
        selectedIconTheme: IconThemeData(color: AppColors.primary),
        unselectedIconTheme: IconThemeData(color: AppColors.textSecondary),
        selectedLabelTextStyle: TextStyle(color: AppColors.primary),
        unselectedLabelTextStyle: TextStyle(color: AppColors.textSecondary),
      ),
      extensions: const [LogLensTheme.dark],
    );
  }
}
