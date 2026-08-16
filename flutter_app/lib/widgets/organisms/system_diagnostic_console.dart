/// Dart port of `src/components/organisms/SystemDiagnosticConsole.tsx`.
///
/// Dev/debug console overlay used during Phase 4 manual RPC-tracing: reads
/// [debugProvider]'s ring buffer and renders each entry as a timestamped,
/// source-tagged row with an expandable JSON detail block, matching the
/// exact display format used while tracing sidecar RPC calls (timestamp,
/// source badge, message, expandable `data` payload).
///
/// Deviations from the React source:
///  - The React version gates its entire render on
///    `import.meta.env.VITE_DEBUG_GUI === "true"` (a Vite build-time flag).
///    There's no Flutter build-time-env equivalent wired into this project,
///    so that gate becomes the optional [enabled] constructor parameter
///    (defaults to `true` -- the caller, not this widget, decides whether a
///    debug build mounts it at all).
///  - The React version is a `fixed`-positioned overlay appended to
///    `document.body`. This port renders as plain content that collapses to
///    nothing (`SizedBox.shrink`) when closed, and anchors itself to the
///    bottom-right of whatever box it's given when open -- place it as the
///    last child of a `Stack` (over the rest of the page) for the same
///    floating-overlay effect.
///  - "Copy JSON" (`navigator.clipboard.writeText`) becomes
///    [Clipboard.setData] via `package:flutter/services.dart`.
library;

import "dart:convert";

import "package:flutter/material.dart";
import "package:flutter/services.dart";
import "package:flutter_riverpod/flutter_riverpod.dart";

import "../../models/debug_log.dart";
import "../../models/health_status.dart";
import "../../providers/debug_provider.dart";
import "../../providers/health_provider.dart";
import "../../theme/app_theme.dart";

class SystemDiagnosticConsole extends ConsumerWidget {
  const SystemDiagnosticConsole({super.key, this.enabled = true});

  /// Mirrors the React `VITE_DEBUG_GUI` build-time gate -- pass `false` to
  /// force this widget to render nothing regardless of [DebugState.isOpen].
  final bool enabled;

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final debugState = ref.watch(debugProvider);
    if (!enabled || !debugState.isOpen) return const SizedBox.shrink();

    final debugNotifier = ref.read(debugProvider.notifier);
    final health = ref.watch(healthProvider).health;

    return Align(
      alignment: Alignment.bottomRight,
      child: Padding(
        padding: const EdgeInsets.only(right: AppSpacing.md, bottom: 80),
        child: ConstrainedBox(
          constraints: const BoxConstraints(maxWidth: 450, maxHeight: 600),
          child: Material(
            color: AppColors.bgSurface.withValues(alpha: 0.95),
            borderRadius: BorderRadius.circular(AppRadius.modal),
            clipBehavior: Clip.antiAlias,
            child: Container(
              decoration: BoxDecoration(
                border: Border.all(color: Colors.white.withValues(alpha: 0.1)),
                borderRadius: BorderRadius.circular(AppRadius.modal),
              ),
              child: Column(
                mainAxisSize: MainAxisSize.min,
                children: [
                  _Header(
                    entryCount: debugState.logs.length,
                    health: health,
                    onClear: debugNotifier.clearLogs,
                    onClose: () => debugNotifier.setOpen(false),
                  ),
                  Flexible(
                    child: debugState.logs.isEmpty
                        ? const _EmptyState()
                        : ListView.builder(
                            padding: const EdgeInsets.all(AppSpacing.xs),
                            shrinkWrap: true,
                            itemCount: debugState.logs.length,
                            itemBuilder: (context, index) => _LogRow(log: debugState.logs[index]),
                          ),
                  ),
                ],
              ),
            ),
          ),
        ),
      ),
    );
  }
}

class _Header extends StatelessWidget {
  const _Header({
    required this.entryCount,
    required this.health,
    required this.onClear,
    required this.onClose,
  });

  final int entryCount;
  final HealthStatus? health;
  final VoidCallback onClear;
  final VoidCallback onClose;

  @override
  Widget build(BuildContext context) {
    return Container(
      padding: const EdgeInsets.all(AppSpacing.md),
      decoration: BoxDecoration(
        color: Colors.white.withValues(alpha: 0.05),
        border: const Border(bottom: BorderSide(color: AppColors.borderSubtle)),
      ),
      child: Row(
        children: [
          Container(
            padding: const EdgeInsets.all(AppSpacing.xs),
            decoration: BoxDecoration(
              color: AppColors.primary.withValues(alpha: 0.1),
              borderRadius: BorderRadius.circular(AppRadius.md),
            ),
            child: const Icon(Icons.terminal, size: 16, color: AppColors.primary),
          ),
          const SizedBox(width: AppSpacing.sm),
          Expanded(
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              mainAxisSize: MainAxisSize.min,
              children: [
                Text("System Diagnostic", style: AppTypography.h2.copyWith(fontWeight: FontWeight.w700)),
                Text(
                  "$entryCount entries recorded".toUpperCase(),
                  style: AppTypography.labelCaps.copyWith(fontSize: 9, color: AppColors.textMuted),
                ),
              ],
            ),
          ),
          if (health != null) ...[
            _StatColumn(
              label: "Uptime",
              value: "${health!.uptime ~/ 3600}h ${(health!.uptime % 3600) ~/ 60}m",
              color: AppColors.primary,
            ),
            const SizedBox(width: AppSpacing.sm),
            _StatColumn(
              label: "Hydration",
              value: "${health!.hydration.misses} misses",
              color: health!.hydration.misses > 0 ? AppColors.warning : AppColors.primary,
            ),
            const SizedBox(width: AppSpacing.sm),
          ],
          IconButton(
            tooltip: "Clear Logs",
            icon: const Icon(Icons.delete_outline, size: 18),
            color: AppColors.textMuted,
            onPressed: onClear,
          ),
          IconButton(
            icon: const Icon(Icons.close, size: 18),
            color: AppColors.textMuted,
            onPressed: onClose,
          ),
        ],
      ),
    );
  }
}

class _StatColumn extends StatelessWidget {
  const _StatColumn({required this.label, required this.value, required this.color});
  final String label;
  final String value;
  final Color color;

  @override
  Widget build(BuildContext context) {
    return Column(
      crossAxisAlignment: CrossAxisAlignment.end,
      mainAxisSize: MainAxisSize.min,
      children: [
        Text(label.toUpperCase(), style: AppTypography.labelCaps.copyWith(fontSize: 8, color: AppColors.textMuted)),
        Text(value, style: AppTypography.log.copyWith(fontSize: 10, color: color)),
      ],
    );
  }
}

class _EmptyState extends StatelessWidget {
  const _EmptyState();

  @override
  Widget build(BuildContext context) {
    return Padding(
      padding: const EdgeInsets.symmetric(vertical: 80),
      child: Column(
        mainAxisSize: MainAxisSize.min,
        children: [
          Icon(Icons.terminal, size: 48, color: AppColors.textMuted.withValues(alpha: 0.3)),
          const SizedBox(height: AppSpacing.sm),
          Text(
            "WAITING FOR EVENTS...",
            style: AppTypography.labelCaps.copyWith(color: AppColors.textMuted.withValues(alpha: 0.3)),
          ),
        ],
      ),
    );
  }
}

class _LogRow extends StatefulWidget {
  const _LogRow({required this.log});
  final DebugLog log;

  @override
  State<_LogRow> createState() => _LogRowState();
}

class _LogRowState extends State<_LogRow> {
  bool _expanded = false;

  IconData _levelIcon(String level) {
    switch (level) {
      case "error":
        return Icons.error_outline;
      case "warn":
        return Icons.warning_amber_outlined;
      case "debug":
        return Icons.code;
      default:
        return Icons.info_outline;
    }
  }

  Color _levelIconColor(String level) {
    switch (level) {
      case "error":
        return AppColors.error;
      case "warn":
        return AppColors.warning;
      case "debug":
        return AppColors.info;
      default:
        return AppColors.primary;
    }
  }

  Color _messageColor(String level) {
    switch (level) {
      case "error":
        return AppColors.error;
      case "warn":
        return AppColors.warning;
      default:
        return AppColors.textSecondary;
    }
  }

  Color _sourceColor(String source) {
    switch (source) {
      case "tauri":
        return AppColors.info;
      case "sidecar":
        return AppColors.warning;
      case "system":
        return AppColors.error;
      default:
        return AppColors.primary;
    }
  }

  String _formatData(Object? data) {
    if (data == null) return "";
    if (data is String) return data;
    try {
      return const JsonEncoder.withIndent("  ").convert(data);
    } catch (_) {
      return data.toString();
    }
  }

  @override
  Widget build(BuildContext context) {
    final log = widget.log;
    final hasData = log.data != null;
    return Container(
      margin: const EdgeInsets.symmetric(vertical: 2),
      padding: const EdgeInsets.all(AppSpacing.sm),
      decoration: BoxDecoration(
        borderRadius: BorderRadius.circular(AppRadius.lg),
        border: Border.all(color: Colors.transparent),
      ),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        mainAxisSize: MainAxisSize.min,
        children: [
          Row(
            children: [
              Icon(_levelIcon(log.level), size: 12, color: _levelIconColor(log.level)),
              const SizedBox(width: 6),
              // Flexible (rather than a bare Text) -- a real ISO-8601
              // timestamp (`DateTime.now().toIso8601String()`, as produced
              // by `DebugNotifier.addLog`) plus the source badge and both
              // trailing icon buttons don't reliably fit the panel's 450px
              // max width at once; this lets the timestamp elide instead of
              // forcing a hard RenderFlex overflow.
              Flexible(
                child: Text(
                  log.timestamp,
                  overflow: TextOverflow.ellipsis,
                  style: AppTypography.log.copyWith(fontSize: 9, color: AppColors.textMuted),
                ),
              ),
              const SizedBox(width: 6),
              Container(
                padding: const EdgeInsets.symmetric(horizontal: 4, vertical: 1),
                decoration: BoxDecoration(
                  color: _sourceColor(log.source).withValues(alpha: 0.1),
                  border: Border.all(color: _sourceColor(log.source).withValues(alpha: 0.2)),
                  borderRadius: BorderRadius.circular(3),
                ),
                child: Text(
                  log.source.toUpperCase(),
                  style: TextStyle(
                    fontSize: 8,
                    fontWeight: FontWeight.w900,
                    color: _sourceColor(log.source),
                  ),
                ),
              ),
              const Spacer(),
              if (hasData)
                IconButton(
                  iconSize: 14,
                  padding: EdgeInsets.zero,
                  constraints: const BoxConstraints(minWidth: 24, minHeight: 24),
                  icon: Icon(_expanded ? Icons.expand_less : Icons.expand_more),
                  color: AppColors.textMuted,
                  onPressed: () => setState(() => _expanded = !_expanded),
                ),
              IconButton(
                tooltip: "Copy entry as JSON",
                iconSize: 12,
                padding: EdgeInsets.zero,
                constraints: const BoxConstraints(minWidth: 24, minHeight: 24),
                icon: const Icon(Icons.copy_all_outlined),
                color: AppColors.textMuted,
                onPressed: () => Clipboard.setData(
                  ClipboardData(
                    text: const JsonEncoder.withIndent("  ").convert({
                      "id": log.id,
                      "timestamp": log.timestamp,
                      "level": log.level,
                      "source": log.source,
                      "message": log.message,
                      if (log.data != null) "data": log.data is String ? log.data : log.data.toString(),
                    }),
                  ),
                ),
              ),
            ],
          ),
          const SizedBox(height: 4),
          Text(
            log.message,
            style: AppTypography.log.copyWith(fontSize: 11, color: _messageColor(log.level)),
          ),
          if (hasData && _expanded) ...[
            const SizedBox(height: 6),
            Container(
              width: double.infinity,
              constraints: const BoxConstraints(maxHeight: 160),
              padding: const EdgeInsets.all(AppSpacing.sm),
              decoration: BoxDecoration(
                color: Colors.black.withValues(alpha: 0.4),
                border: Border.all(color: Colors.white.withValues(alpha: 0.05)),
                borderRadius: BorderRadius.circular(AppRadius.md),
              ),
              child: SingleChildScrollView(
                child: Text(
                  _formatData(log.data),
                  style: AppTypography.log.copyWith(fontSize: 9, color: AppColors.textMuted),
                ),
              ),
            ),
          ],
        ],
      ),
    );
  }
}
