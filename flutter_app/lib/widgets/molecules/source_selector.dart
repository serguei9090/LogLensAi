/// Dart port of `src/components/molecules/SourceSelector.tsx`.
///
/// A glassmorphic segmented control used for high-level navigation between
/// data sources / ingestion types (e.g. "Local File" vs "SSH" vs "Paste").
library;

import "package:flutter/material.dart";

import "../../theme/app_colors.dart";
import "../../theme/app_typography.dart";

/// Mirrors the TS `SourceOption { id, icon, label }` shape.
class SourceSelectorOption {
  const SourceSelectorOption({required this.id, required this.icon, required this.label});

  final String id;
  final IconData icon;
  final String label;
}

class SourceSelector extends StatelessWidget {
  const SourceSelector({
    super.key,
    required this.options,
    required this.activeId,
    required this.onSelect,
  });

  final List<SourceSelectorOption> options;
  final String activeId;
  final ValueChanged<String> onSelect;

  @override
  Widget build(BuildContext context) {
    return Container(
      padding: const EdgeInsets.all(4),
      decoration: BoxDecoration(
        color: AppColors.bgBase.withValues(alpha: 0.8),
        borderRadius: BorderRadius.circular(16),
        border: Border.all(color: AppColors.border.withValues(alpha: 0.6)),
      ),
      child: Row(
        mainAxisSize: MainAxisSize.min,
        children: [
          for (var i = 0; i < options.length; i++) ...[
            if (i > 0) const SizedBox(width: 6),
            _SegmentButton(
              option: options[i],
              isActive: options[i].id == activeId,
              onTap: () => onSelect(options[i].id),
            ),
          ],
        ],
      ),
    );
  }
}

class _SegmentButton extends StatelessWidget {
  const _SegmentButton({required this.option, required this.isActive, required this.onTap});

  final SourceSelectorOption option;
  final bool isActive;
  final VoidCallback onTap;

  @override
  Widget build(BuildContext context) {
    return Material(
      color: isActive ? AppColors.primary : Colors.transparent,
      borderRadius: BorderRadius.circular(12),
      child: InkWell(
        borderRadius: BorderRadius.circular(12),
        onTap: onTap,
        hoverColor: isActive ? Colors.transparent : Colors.white.withValues(alpha: 0.05),
        child: Padding(
          padding: const EdgeInsets.symmetric(horizontal: 16, vertical: 8),
          child: Row(
            mainAxisSize: MainAxisSize.min,
            children: [
              Icon(
                option.icon,
                size: 16,
                color: isActive ? AppColors.textInverse : AppColors.textMuted,
              ),
              const SizedBox(width: 8),
              Text(
                option.label,
                style: AppTypography.labelCaps.copyWith(
                  fontSize: 11,
                  letterSpacing: 0,
                  color: isActive ? AppColors.textInverse : AppColors.textMuted,
                ),
              ),
            ],
          ),
        ),
      ),
    );
  }
}
