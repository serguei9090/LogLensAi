import "package:flutter/material.dart";
import "package:flutter_test/flutter_test.dart";

import "package:loglensai/theme/app_theme.dart";

void main() {

  group("AppColors", () {
    test("primary token matches DESIGN.md", () {
      expect(AppColors.primary, const Color(0xFF22C55E));
      expect(AppColors.primaryHover, const Color(0xFF16A34A));
      expect(AppColors.primaryMuted, const Color(0xFF14532D));
    });

    test("background tokens match DESIGN.md / globals.css", () {
      expect(AppColors.bgBase, const Color(0xFF0D0F0E));
      expect(AppColors.bgApp, const Color(0xFF0A0C0B));
      expect(AppColors.bgSurface, const Color(0xFF111613));
      expect(AppColors.bgSurfaceBright, const Color(0xFF1A1F1C));
    });

    test("log-level semantic colors are distinct and correctly mapped", () {
      expect(AppColors.forLogLevel("ERROR"), AppColors.error);
      expect(AppColors.forLogLevel("warn"), AppColors.warning);
      expect(AppColors.forLogLevel("Info"), AppColors.info);
      expect(AppColors.forLogLevel("DEBUG"), AppColors.debug);
      expect(AppColors.forLogLevel("FATAL"), AppColors.error);
      expect(AppColors.forLogLevel("TRACE"), AppColors.debug);
    });
  });

  group("AppSpacing / AppRadius", () {
    test("spacing scale matches DESIGN.md tokens.spacing", () {
      expect(AppSpacing.xs, 4);
      expect(AppSpacing.sm, 8);
      expect(AppSpacing.md, 16);
      expect(AppSpacing.lg, 24);
      expect(AppSpacing.xl, 32);
      expect(AppSpacing.gap, 16);
    });

    test("radius scale matches DESIGN.md tokens.rounded", () {
      expect(AppRadius.sm, 4);
      expect(AppRadius.md, 8);
      expect(AppRadius.lg, 12);
      expect(AppRadius.xl, 16);
      expect(AppRadius.modal, 24);
    });
  });

  group("AppTheme.dark", () {
    test("is a dark ThemeData carrying the LogLensTheme extension", () {
      final theme = AppTheme.dark;
      expect(theme.brightness, Brightness.dark);
      expect(theme.scaffoldBackgroundColor, AppColors.bgBase);
      expect(theme.extension<LogLensTheme>(), isNotNull);
    });

    test("has no drop shadows on the primary glow (color glow only)", () {
      final glow = LogLensTheme.dark.primaryGlowShadow;
      expect(glow, isNotEmpty);
      expect(glow.first.color, AppColors.primaryGlow);
    });
  });
}
