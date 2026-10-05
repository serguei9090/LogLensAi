# UI Architecture Standards (Flutter / LogLensAi)

## 1. Core Principles (Invariants)
* **Design Token Strictness:** Source of truth is `DESIGN.md` ported to `flutter_app/lib/theme/` (`AppColors`, `AppSpacing`, `AppTypography`). Hardcoded hex colors and arbitrary margins/paddings are strictly prohibited.
* **Separation of Concerns:** Atoms and Molecules must be stateless presentation widgets. No direct Riverpod `ref.watch` or `ref.read` calls inside Atoms.
* **State Ownership:** Organisms and Pages own Riverpod state integration.

## 2. Widget Tier Classification (`flutter_app/lib/widgets/`)
1. **Atoms (`widgets/atoms/`):** Smallest foundational widgets (e.g., `StatusDot`, `LogLevelBadge`, `IconButton`, `TailSwitch`). Pure props in, UI out. No business logic, no Riverpod state reads.
2. **Molecules (`widgets/molecules/`):** Composed combinations of atoms (e.g., `SearchBar`, `FilterBuilder`, `ClusterRow`, `SourceItem`). Simple callback event handlers.
3. **Organisms (`widgets/organisms/`):** Complex UI panels and sections (e.g., `LogToolbar`, `VirtualLogTable`, `Sidebar`, `AIInvestigationSidebar`). May connect to Riverpod providers.
4. **Pages (`pages/`):** Full screen compositions (e.g., `DashboardPage`, `InvestigationPage`, `SettingsPage`). Own page-level layout and coordination.

## 3. Forbidden Patterns (Strict)
1. **Logic Leak:** Making raw HTTP or subprocess sidecar calls directly from widgets. All calls go through Riverpod providers wrapping `sidecar_bridge.dart`.
2. **Style Drift:** Hardcoding hex colors like `Color(0xFF22C55E)` instead of `AppColors.primary`.
3. **Over-virtualization / Jitter:** In list and log views, preserve keys and avoid unconstrained infinite height rebuilds.

## 4. Golden Example (The Ideal Molecule)
```dart
// flutter_app/lib/widgets/molecules/filter_builder.dart
import 'package:flutter/material.dart';
import 'package:flutter_app/theme/app_colors.dart';
import 'package:flutter_app/theme/app_spacing.dart';
import 'package:flutter_app/widgets/atoms/log_level_badge.dart';

class FilterBuilder extends StatelessWidget {
  final String activeLevel;
  final ValueChanged<String> onLevelSelected;

  const FilterBuilder({
    super.key,
    required this.activeLevel,
    required this.onLevelSelected,
  });

  @override
  Widget build(BuildContext context) {
    return Row(
      children: [
        LogLevelBadge(
          level: activeLevel,
          isSelected: true,
          onTap: () => onLevelSelected(activeLevel),
        ),
        const SizedBox(width: AppSpacing.sm),
      ],
    );
  }
}
```