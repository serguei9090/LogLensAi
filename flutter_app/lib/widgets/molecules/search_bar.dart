/// Dart port of `src/components/molecules/SearchBar.tsx`.
///
/// The main log-search text input: a search icon, a debounced text field,
/// and a clear button that appears once there's text. The debounce mirrors
/// the React source's `useDebounce(localValue, 300)` call exactly (see
/// `src/lib/hooks/useDebounce.ts` — a plain `setTimeout`/`clearTimeout`
/// debounce with no leading edge), NOT `investigationStore.ts` (that store
/// holds `searchQuery` as a plain, already-debounced field via
/// `setSearchQuery` -- it performs no debouncing of its own; the debounce
/// lives entirely in this component).
///
/// Named [LogSearchBar] rather than `SearchBar` to avoid clashing with
/// Flutter Material's own `SearchBar` widget (`material.dart` exports a
/// class of that exact name as of Flutter 3.7+); the file is still named
/// `search_bar.dart` to mirror the React source 1:1.
library;

import "dart:async";

import "package:flutter/material.dart";

import "../../theme/app_colors.dart";
import "../../theme/app_spacing.dart";
import "../../theme/app_typography.dart";

class LogSearchBar extends StatefulWidget {
  const LogSearchBar({
    super.key,
    required this.value,
    required this.onChange,
    this.placeholder = "Search logs (e.g., level:error AND 'database')...",
    this.disabled = false,
    this.debounce = const Duration(milliseconds: 300),
  });

  /// Controlled value from the parent (e.g. `investigationStore`'s
  /// `searchQuery`). Mirrors the React prop of the same name.
  final String value;

  /// Fired [debounce] after the user stops typing, with the latest text.
  final ValueChanged<String> onChange;

  final String placeholder;
  final bool disabled;

  /// Debounce delay. Defaults to 300ms, matching `useDebounce(localValue,
  /// 300)` in the React source.
  final Duration debounce;

  @override
  State<LogSearchBar> createState() => _LogSearchBarState();
}

class _LogSearchBarState extends State<LogSearchBar> {
  late final TextEditingController _controller = TextEditingController(text: widget.value);
  Timer? _debounceTimer;

  @override
  void didUpdateWidget(covariant LogSearchBar oldWidget) {
    super.didUpdateWidget(oldWidget);
    // Mirrors `useEffect(() => setLocalValue(value), [value])`: if the
    // controlled value changes out from under us (e.g. reset elsewhere) and
    // doesn't already match what's on screen, resync the field.
    if (widget.value != oldWidget.value && widget.value != _controller.text) {
      _controller.value = _controller.value.copyWith(
        text: widget.value,
        selection: TextSelection.collapsed(offset: widget.value.length),
        composing: TextRange.empty,
      );
    }
  }

  void _handleChanged(String text) {
    setState(() {}); // Refresh clear-button visibility.
    _debounceTimer?.cancel();
    _debounceTimer = Timer(widget.debounce, () {
      if (mounted) widget.onChange(text);
    });
  }

  void _handleClear() {
    _debounceTimer?.cancel();
    _controller.clear();
    widget.onChange("");
    setState(() {});
  }

  @override
  void dispose() {
    _debounceTimer?.cancel();
    _controller.dispose();
    super.dispose();
  }

  @override
  Widget build(BuildContext context) {
    return ConstrainedBox(
      // React: `max-w-sm` = 24rem = 384px.
      constraints: const BoxConstraints(maxWidth: 384),
      child: TextField(
        controller: _controller,
        enabled: !widget.disabled,
        autocorrect: false,
        onChanged: _handleChanged,
        style: AppTypography.body.copyWith(fontSize: 13, color: AppColors.textPrimary),
        decoration: InputDecoration(
          isDense: true,
          filled: true,
          fillColor: AppColors.bgSurfaceBright,
          hintText: widget.placeholder,
          hintStyle: AppTypography.body.copyWith(fontSize: 13, color: AppColors.textMuted),
          prefixIcon: const Icon(Icons.search, size: 16, color: AppColors.textMuted),
          prefixIconConstraints: const BoxConstraints(minWidth: 36, minHeight: 16),
          suffixIcon: _controller.text.isEmpty
              ? null
              : IconButton(
                  icon: const Icon(Icons.close, size: 14),
                  color: AppColors.textMuted,
                  tooltip: "Clear search",
                  splashRadius: 14,
                  onPressed: widget.disabled ? null : _handleClear,
                ),
          suffixIconConstraints: const BoxConstraints(minWidth: 32, minHeight: 16),
          contentPadding: const EdgeInsets.symmetric(vertical: AppSpacing.sm),
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
          disabledBorder: OutlineInputBorder(
            borderRadius: BorderRadius.circular(AppRadius.md),
            borderSide: BorderSide(color: AppColors.border.withValues(alpha: 0.5)),
          ),
        ),
      ),
    );
  }
}
