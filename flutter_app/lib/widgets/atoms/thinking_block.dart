import "dart:async";

import "package:flutter/material.dart";

import "../../theme/app_theme.dart";

/// Collapsible "AI reasoning" block shown above a chat message.
///
/// Port of `src/components/atoms/ThinkingBlock.tsx`. A custom collapsible
/// (rather than Flutter's stock [ExpansionTile], which owns its own tile
/// chrome/divider styling that doesn't match this port's chevron+label
/// header) reproducing the same behaviors as the React source:
///  - Collapsed by default; header shows "thinking…" while [isStreaming],
///    else "thought for N.Ns" (from [durationMs] once known, or a live
///    elapsed-time counter while it was streaming) or "thought process"
///    before any duration is known.
///  - Auto-expands the instant [isStreaming] flips false -> true.
///  - Auto-collapses ~2s after [isStreaming] flips true -> false (matches
///    the React source's `setTimeout(..., 2000)`), so the user has a
///    moment to see it just finished before it retracts.
///  - Renders nothing when there's no [content] and it isn't streaming.
class ThinkingBlock extends StatefulWidget {
  const ThinkingBlock({
    super.key,
    required this.content,
    this.isStreaming = false,
    this.durationMs,
  });

  /// The raw thinking/reasoning content extracted from e.g. `<think>` tags.
  final String content;

  /// Whether the model is still actively generating (streaming thinking
  /// live).
  final bool isStreaming;

  /// Optional time it took to think, in milliseconds. Once known this
  /// takes priority over the live elapsed-time counter for the header
  /// label.
  final int? durationMs;

  @override
  State<ThinkingBlock> createState() => _ThinkingBlockState();
}

class _ThinkingBlockState extends State<ThinkingBlock> {
  bool _expanded = false;
  Timer? _durationTimer;
  Timer? _collapseTimer;
  int _activeDurationMs = 0;

  // Deliberately *not* `late ... = widget.isStreaming` -- a `late` field
  // initializer is evaluated lazily on first read, and the first read here
  // happens inside `didUpdateWidget`, by which point `widget` already
  // refers to the *new* instance. Setting it eagerly in `initState` avoids
  // that trap.
  bool _wasStreaming = false;

  @override
  void initState() {
    super.initState();
    _wasStreaming = widget.isStreaming;
    if (widget.isStreaming) {
      _expanded = true;
      _startDurationTimer();
    }
  }

  @override
  void didUpdateWidget(covariant ThinkingBlock oldWidget) {
    super.didUpdateWidget(oldWidget);

    if (widget.isStreaming && !oldWidget.isStreaming) {
      // Streaming just started: auto-expand and start the live counter.
      _expanded = true;
      _activeDurationMs = 0;
      _startDurationTimer();
    } else if (!widget.isStreaming && oldWidget.isStreaming) {
      _stopDurationTimer();
    }

    if (_wasStreaming && !widget.isStreaming) {
      // Streaming just finished: retract shortly after, same as the React
      // source's 2s auto-collapse delay.
      _collapseTimer?.cancel();
      _collapseTimer = Timer(const Duration(milliseconds: 2000), () {
        if (mounted) {
          setState(() => _expanded = false);
        }
      });
    }
    _wasStreaming = widget.isStreaming;
  }

  void _startDurationTimer() {
    _durationTimer?.cancel();
    _durationTimer = Timer.periodic(const Duration(milliseconds: 100), (_) {
      if (mounted) {
        setState(() => _activeDurationMs += 100);
      }
    });
  }

  void _stopDurationTimer() {
    _durationTimer?.cancel();
    _durationTimer = null;
  }

  @override
  void dispose() {
    _durationTimer?.cancel();
    _collapseTimer?.cancel();
    super.dispose();
  }

  String get _label {
    if (widget.isStreaming) {
      return "thinking…";
    }
    final durationMs = widget.durationMs;
    if (durationMs != null && durationMs > 0) {
      return "thought for ${(durationMs / 1000).toStringAsFixed(1)} seconds";
    }
    if (_activeDurationMs > 0) {
      return "thought for ${(_activeDurationMs / 1000).toStringAsFixed(1)} seconds";
    }
    return "thought process";
  }

  @override
  Widget build(BuildContext context) {
    if (widget.content.isEmpty && !widget.isStreaming) {
      return const SizedBox.shrink();
    }

    return Padding(
      padding: const EdgeInsets.only(bottom: AppSpacing.lg),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        mainAxisSize: MainAxisSize.min,
        children: [
          InkWell(
            onTap: () => setState(() => _expanded = !_expanded),
            borderRadius: BorderRadius.circular(AppRadius.sm),
            child: Padding(
              padding: const EdgeInsets.symmetric(vertical: 4),
              child: Row(
                mainAxisSize: MainAxisSize.min,
                children: [
                  Icon(
                    _expanded ? Icons.keyboard_arrow_down : Icons.chevron_right,
                    size: 14,
                    color: AppColors.textSecondary,
                  ),
                  const SizedBox(width: AppSpacing.xs + 2),
                  Text(
                    _label,
                    style: AppTypography.body.copyWith(
                      fontSize: 13,
                      fontWeight: FontWeight.w500,
                      color: AppColors.textSecondary,
                    ),
                  ),
                ],
              ),
            ),
          ),
          AnimatedSize(
            duration: const Duration(milliseconds: 300),
            curve: Curves.easeInOut,
            alignment: Alignment.topLeft,
            child: !_expanded
                ? const SizedBox(width: double.infinity)
                : Container(
                    width: double.infinity,
                    constraints: const BoxConstraints(maxHeight: 400),
                    margin: const EdgeInsets.only(left: 7, top: 4),
                    padding: const EdgeInsets.only(
                      left: AppSpacing.md,
                      right: AppSpacing.xs,
                      top: AppSpacing.sm,
                      bottom: AppSpacing.sm,
                    ),
                    decoration: BoxDecoration(
                      border: Border(left: BorderSide(color: AppColors.border, width: 2)),
                    ),
                    child: SingleChildScrollView(
                      child: Column(
                        crossAxisAlignment: CrossAxisAlignment.start,
                        mainAxisSize: MainAxisSize.min,
                        children: [
                          Text(
                            "REASONING CHAIN",
                            style: AppTypography.labelCaps.copyWith(
                              color: AppColors.textSecondary.withValues(alpha: 0.4),
                            ),
                          ),
                          const SizedBox(height: AppSpacing.sm),
                          Text(
                            widget.content,
                            style: AppTypography.body.copyWith(
                              fontSize: 14,
                              color: AppColors.textSecondary.withValues(alpha: 0.8),
                              height: 1.6,
                            ),
                          ),
                        ],
                      ),
                    ),
                  ),
          ),
        ],
      ),
    );
  }
}
