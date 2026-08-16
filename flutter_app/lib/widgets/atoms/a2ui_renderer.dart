import "dart:convert";

import "package:flutter/material.dart";

import "../../theme/app_theme.dart";

/// A single node in an AI-generated "A2UI" JSON payload tree. Mirrors the
/// TS `A2UIComponent` interface from
/// `src/components/atoms/A2UIRenderer.tsx`.
class A2UIComponent {
  const A2UIComponent({
    required this.type,
    this.text,
    this.label,
    this.children = const [],
    this.props = const {},
    this.action,
  });

  final String type;
  final String? text;
  final String? label;
  final List<A2UIComponent> children;
  final Map<String, dynamic> props;
  final Map<String, dynamic>? action;

  factory A2UIComponent.fromJson(Map<String, dynamic> json) {
    final rawChildren = json["children"];
    return A2UIComponent(
      type: json["type"] as String? ?? "",
      text: json["text"] as String?,
      label: json["label"] as String?,
      children: rawChildren is List
          ? rawChildren
              .whereType<Map<String, dynamic>>()
              .map(A2UIComponent.fromJson)
              .toList()
          : const [],
      props: (json["props"] as Map<String, dynamic>?) ?? const {},
      action: json["action"] as Map<String, dynamic>?,
    );
  }
}

/// Renders AI-generated "A2UI" JSON payloads (dynamic charts/tables/
/// metrics/buttons) inline in the chat transcript.
///
/// Port of `src/components/atoms/A2UIRenderer.tsx`. Covers the same
/// dispatch pattern (switch on `payload.type`, recursive `children`) and a
/// representative subset of concrete node types (`text`, `button`,
/// `metric`, `data_table`, `card`, `stack_v`, `stack_h`, `surface`/`root`,
/// plus the compact `markup` string format with its malformed-blueprint
/// fallback) rather than every case the React source handles.
///
/// Deviation: the React `metric`/`data_table` cases (`LiveMetric`/
/// `LiveDataTable`) poll `callSidecar` on a 5s interval to fetch live
/// numbers. That live-data wiring is organism-tier concern (needs the
/// Riverpod sidecar bridge + workspace provider); this atom renders
/// statically from whatever `value`/`rows` are already present in
/// `props`, leaving the live-refresh wiring to whatever organism embeds
/// it later.
class A2UIRenderer extends StatelessWidget {
  const A2UIRenderer({super.key, required this.payload, this.onAction});

  /// The A2UI payload, already decoded from JSON. `null`/non-map payloads
  /// render nothing (mirrors the React source's early-return).
  final Map<String, dynamic>? payload;

  /// Invoked with a button node's `action` map when tapped.
  final void Function(Map<String, dynamic>? action)? onAction;

  @override
  Widget build(BuildContext context) {
    final rawPayload = payload;
    if (rawPayload == null) {
      return const SizedBox.shrink();
    }

    A2UIComponent? resolved;
    final raw = rawPayload["raw"];
    if (rawPayload["type"] == "markup" && raw is String) {
      resolved = _parseA2UIMarkup(raw);
      if (resolved == null) {
        return Container(
          margin: const EdgeInsets.only(top: AppSpacing.sm),
          padding: const EdgeInsets.symmetric(horizontal: AppSpacing.sm, vertical: 10),
          decoration: BoxDecoration(
            color: AppColors.bgSurfaceBright.withValues(alpha: 0.5),
            border: Border.all(color: AppColors.border.withValues(alpha: 0.4)),
            borderRadius: BorderRadius.circular(AppRadius.lg),
          ),
          child: Text(
            "[Malformed A2UI Blueprint]",
            style: AppTypography.body.copyWith(
              fontSize: 10,
              fontStyle: FontStyle.italic,
              color: AppColors.textMuted,
            ),
          ),
        );
      }
    } else {
      resolved = A2UIComponent.fromJson(rawPayload);
    }

    return Padding(
      padding: const EdgeInsets.only(top: AppSpacing.sm),
      child: _renderComponent(resolved),
    );
  }

  Widget _renderComponent(A2UIComponent comp) {
    switch (comp.type) {
      case "text":
        return Padding(
          padding: const EdgeInsets.only(bottom: AppSpacing.sm),
          child: Text(
            comp.text ?? "",
            style: AppTypography.body.copyWith(
              fontSize: 13,
              color: AppColors.textSecondary,
              height: 1.5,
            ),
          ),
        );

      case "button":
        return Padding(
          padding: const EdgeInsets.only(bottom: AppSpacing.sm, right: AppSpacing.sm),
          child: OutlinedButton(
            onPressed: () => onAction?.call(comp.action),
            style: OutlinedButton.styleFrom(
              foregroundColor: AppColors.primary,
              backgroundColor: AppColors.primary.withValues(alpha: 0.05),
              side: BorderSide(color: AppColors.primary.withValues(alpha: 0.2)),
              minimumSize: const Size(0, 32),
              padding: const EdgeInsets.symmetric(horizontal: AppSpacing.sm),
            ),
            child: Text(
              (comp.label ?? "").toUpperCase(),
              style: const TextStyle(fontSize: 11, fontWeight: FontWeight.w700, letterSpacing: 0.5),
            ),
          ),
        );

      case "metric":
        return _MetricCard(
          label: comp.label ?? "Metric",
          value: comp.props["value"]?.toString(),
        );

      case "chart_area":
        // No dedicated chart widget exists at atom tier yet (organism-tier
        // follow-up); falls back to the same metric tile the React source
        // itself falls back to for this case.
        return _MetricCard(
          label: comp.label ?? "Chart Data",
          value: comp.props["value"]?.toString(),
        );

      case "data_table":
        return _DataTableCard(
          title: comp.label ?? "Data Table",
          rows: _extractRows(comp.props["rows"]),
        );

      case "card":
        return _SurfaceCard(
          label: comp.label,
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [for (final child in comp.children) _renderComponent(child)],
          ),
        );

      case "stack_v":
        return Padding(
          padding: const EdgeInsets.only(bottom: AppSpacing.sm),
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [for (final child in comp.children) _renderComponent(child)],
          ),
        );

      case "stack_h":
        return Padding(
          padding: const EdgeInsets.only(bottom: AppSpacing.sm),
          child: Wrap(
            spacing: AppSpacing.sm,
            runSpacing: AppSpacing.sm,
            children: [for (final child in comp.children) _renderComponent(child)],
          ),
        );

      case "surface":
      case "root":
        return Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [for (final child in comp.children) _renderComponent(child)],
        );

      default:
        // Unknown/unsupported node type -- graceful no-op, matches the
        // React source's `default: return null`.
        return const SizedBox.shrink();
    }
  }
}

List<Map<String, dynamic>> _extractRows(dynamic raw) {
  if (raw is! List) {
    return const [];
  }
  return raw.whereType<Map<String, dynamic>>().toList();
}

/// Parser for the compact A2UI Markup format (e.g.
/// `button label="Text" action={"type":"..."}`).
///
/// Port of `parseA2UIMarkup` in the React source. Covers `button`, `text`,
/// `metric`, and `data_table` -- the concrete node types this port renders
/// -- and drops the `chart_area` markup tag (which the React source's own
/// renderer collapses into `metric` output anyway).
A2UIComponent? _parseA2UIMarkup(String raw) {
  final trimmed = raw.trim();

  if (trimmed.startsWith("button")) {
    final labelMatch = RegExp('label=["\']([^"\']+)["\']').firstMatch(trimmed);
    if (labelMatch != null) {
      Map<String, dynamic>? action;
      final actionMatch = RegExp(r"action=\{([^}]+)\}").firstMatch(trimmed);
      if (actionMatch != null) {
        try {
          action = jsonDecode("{${actionMatch.group(1)}}") as Map<String, dynamic>;
        } catch (_) {
          // Malformed action JSON -- matches React's "warn and continue".
        }
      }
      return A2UIComponent(type: "button", label: labelMatch.group(1), action: action);
    }
  }

  if (trimmed.startsWith("text")) {
    final textMatch = RegExp('value=["\']([^"\']+)["\']').firstMatch(trimmed);
    if (textMatch != null) {
      return A2UIComponent(type: "text", text: textMatch.group(1));
    }
  }

  if (trimmed.startsWith("metric")) {
    final labelMatch = RegExp('label=["\']([^"\']+)["\']').firstMatch(trimmed);
    final queryMatch = RegExp('query=["\']([^"\']+)["\']').firstMatch(trimmed);
    if (labelMatch != null && queryMatch != null) {
      return A2UIComponent(
        type: "metric",
        label: labelMatch.group(1),
        props: {"query": queryMatch.group(1)},
      );
    }
  }

  if (trimmed.startsWith("data_table")) {
    final titleMatch = RegExp('title=["\']([^"\']+)["\']').firstMatch(trimmed);
    final queryMatch = RegExp('query=["\']([^"\']+)["\']').firstMatch(trimmed);
    if (titleMatch != null && queryMatch != null) {
      return A2UIComponent(
        type: "data_table",
        label: titleMatch.group(1),
        props: {"query": queryMatch.group(1)},
      );
    }
  }

  return null;
}

class _MetricCard extends StatelessWidget {
  const _MetricCard({required this.label, this.value});

  final String label;
  final String? value;

  @override
  Widget build(BuildContext context) {
    return Container(
      width: double.infinity,
      margin: const EdgeInsets.only(bottom: AppSpacing.sm),
      padding: const EdgeInsets.all(AppSpacing.md),
      decoration: BoxDecoration(
        color: AppColors.bgSurface.withValues(alpha: 0.5),
        border: Border.all(color: AppColors.border.withValues(alpha: 0.6)),
        borderRadius: BorderRadius.circular(AppRadius.lg),
      ),
      child: Column(
        mainAxisSize: MainAxisSize.min,
        children: [
          Text(
            label.toUpperCase(),
            style: AppTypography.labelCaps.copyWith(color: AppColors.textMuted),
          ),
          const SizedBox(height: AppSpacing.xs),
          Text(
            value ?? "...",
            style: AppTypography.monoBody.copyWith(
              fontSize: 28,
              fontWeight: FontWeight.w900,
              color: AppColors.primary,
            ),
          ),
        ],
      ),
    );
  }
}

class _DataTableCard extends StatelessWidget {
  const _DataTableCard({required this.title, required this.rows});

  final String title;
  final List<Map<String, dynamic>> rows;

  @override
  Widget build(BuildContext context) {
    return Container(
      width: double.infinity,
      margin: const EdgeInsets.only(bottom: AppSpacing.sm),
      decoration: BoxDecoration(
        color: AppColors.bgSurface.withValues(alpha: 0.5),
        border: Border.all(color: AppColors.border.withValues(alpha: 0.6)),
        borderRadius: BorderRadius.circular(AppRadius.lg),
      ),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        mainAxisSize: MainAxisSize.min,
        children: [
          Container(
            width: double.infinity,
            padding: const EdgeInsets.symmetric(horizontal: AppSpacing.md, vertical: AppSpacing.sm),
            decoration: BoxDecoration(
              border: Border(bottom: BorderSide(color: AppColors.border.withValues(alpha: 0.6))),
            ),
            child: Text(
              title.toUpperCase(),
              style: AppTypography.labelCaps.copyWith(color: AppColors.textPrimary),
            ),
          ),
          if (rows.isEmpty)
            Padding(
              padding: const EdgeInsets.all(AppSpacing.md),
              child: Text(
                "No data",
                style: AppTypography.body.copyWith(fontSize: 11, color: AppColors.textMuted),
              ),
            )
          else
            for (final row in rows)
              Container(
                width: double.infinity,
                padding: const EdgeInsets.symmetric(horizontal: AppSpacing.md, vertical: AppSpacing.xs),
                decoration: BoxDecoration(
                  border: Border(bottom: BorderSide(color: AppColors.border.withValues(alpha: 0.3))),
                ),
                child: Text(
                  row.values.map((v) => v.toString()).join("  "),
                  style: AppTypography.log.copyWith(fontSize: 11, color: AppColors.textSecondary),
                  overflow: TextOverflow.ellipsis,
                ),
              ),
        ],
      ),
    );
  }
}

class _SurfaceCard extends StatelessWidget {
  const _SurfaceCard({required this.child, this.label});

  final Widget child;
  final String? label;

  @override
  Widget build(BuildContext context) {
    return Container(
      width: double.infinity,
      margin: const EdgeInsets.only(bottom: AppSpacing.sm),
      decoration: BoxDecoration(
        color: AppColors.bgSurface.withValues(alpha: 0.5),
        border: Border.all(color: AppColors.border.withValues(alpha: 0.6)),
        borderRadius: BorderRadius.circular(AppRadius.lg),
      ),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        mainAxisSize: MainAxisSize.min,
        children: [
          if (label != null)
            Container(
              width: double.infinity,
              padding: const EdgeInsets.symmetric(horizontal: AppSpacing.md, vertical: AppSpacing.sm),
              decoration: BoxDecoration(
                border: Border(bottom: BorderSide(color: AppColors.border.withValues(alpha: 0.6))),
              ),
              child: Text(
                label!.toUpperCase(),
                style: AppTypography.labelCaps.copyWith(color: AppColors.textPrimary),
              ),
            ),
          Padding(padding: const EdgeInsets.all(AppSpacing.md), child: child),
        ],
      ),
    );
  }
}
