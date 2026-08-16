/// Dart port of `src/components/molecules/TimeRangePicker.tsx`.
///
/// The React source (400+ lines) is a custom popover containing a preset
/// list, a dual-month `react-day-picker` range calendar with its own
/// days/months/years drill-down views, and HH:MM:SS segment steppers for
/// both endpoints. This port keeps the two functional pillars -- a preset
/// list and a working custom range picker -- but trades the hand-built
/// dual-calendar/drill-down chrome for a [Dialog] built on Flutter's stock
/// [showDatePicker], for two reasons:
///
///  1. Time budget: reimplementing react-day-picker's days/months/years
///     view-cycling from scratch in Dart is a multi-day task on its own.
///  2. **Fidelity, not just speed**: the React calendar is a true *range*
///     picker (`mode="range"`), but the feature it's built to express is
///     "start date, optionally an end date -- absent end means streaming to
///     now" (see the "Streaming (Now)" copy in the original and the
///     disabled End row when `!hasEndDate`). Flutter's `showDateRangePicker`
///     forces both ends of a range to be chosen together, which can't
///     represent "no end date" at all. Two independent [showDatePicker]
///     calls (start, and an optional/clearable end) reproduce the *actual*
///     open-ended-range semantics more faithfully than forcing the built-in
///     range widget would.
///
/// The HH:MM:SS steppers, the 6 quick-select presets (identical labels/
/// deltas to `PRESETS` in the React source), the disabled-until-end-date End
/// row, and the Reset-to-"All Time" action are all preserved.
library;

import "package:flutter/material.dart";

import "../../theme/app_colors.dart";
import "../../theme/app_spacing.dart";
import "../../theme/app_typography.dart";

/// Mirrors the TS `TimeRange { start, end, label? }` shape. `start`/`end`
/// are "nominal" ISO strings (`yyyy-MM-ddTHH:mm:ss`, no timezone/offset --
/// wall-clock, not UTC-converted) or `""` when unset/open-ended.
class TimeRange {
  const TimeRange({required this.start, required this.end, this.label});

  final String start;
  final String end;
  final String? label;

  TimeRange copyWith({String? start, String? end, Object? label = _unsetLabel}) {
    return TimeRange(
      start: start ?? this.start,
      end: end ?? this.end,
      label: identical(label, _unsetLabel) ? this.label : label as String?,
    );
  }

  @override
  bool operator ==(Object other) =>
      other is TimeRange && other.start == start && other.end == end && other.label == label;

  @override
  int get hashCode => Object.hash(start, end, label);
}

const Object _unsetLabel = Object();

// ── Helpers ─────────────────────────────────────────────────────────────

String _pad2(int n) => n.toString().padLeft(2, "0");

/// "Nominal ISO" (no timezone conversion) -- mirrors `toNominalISO` in the
/// React source.
String _toNominalIso(DateTime d) {
  final y = d.year.toString().padLeft(4, "0");
  return "$y-${_pad2(d.month)}-${_pad2(d.day)}T${_pad2(d.hour)}:${_pad2(d.minute)}:${_pad2(d.second)}";
}

const List<String> _monthAbbrev = [
  "Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec",
];

String _formatDateTime(DateTime d) =>
    "${_monthAbbrev[d.month - 1]} ${d.day}, ${d.year} ${_pad2(d.hour)}:${_pad2(d.minute)}:${_pad2(d.second)}";

String _formatDateOnly(DateTime d) => "${_monthAbbrev[d.month - 1]} ${d.day}, ${d.year}";

DateTime _dateOnly(DateTime d) => DateTime(d.year, d.month, d.day);

class _Preset {
  const _Preset(this.label, this.getStart);
  final String label;
  final DateTime Function(DateTime now) getStart;
}

final List<_Preset> _presets = [
  _Preset("Last 15 min", (now) => now.subtract(const Duration(minutes: 15))),
  _Preset("Last 1 hour", (now) => now.subtract(const Duration(hours: 1))),
  _Preset("Last 4 hours", (now) => now.subtract(const Duration(hours: 4))),
  _Preset("Last 24 hrs", (now) => now.subtract(const Duration(hours: 24))),
  _Preset("Last 7 days", (now) => now.subtract(const Duration(days: 7))),
  _Preset("Today", (now) => _dateOnly(now)),
];

// ── TimeRangePicker ────────────────────────────────────────────────────

class TimeRangePicker extends StatelessWidget {
  const TimeRangePicker({super.key, required this.value, required this.onChange});

  final TimeRange value;
  final ValueChanged<TimeRange> onChange;

  String get _displayText {
    if (value.label != null && value.label!.isNotEmpty) return value.label!;
    if (value.start.isEmpty) return "All Time";
    final s = DateTime.tryParse(value.start);
    final startText = s != null ? _formatDateTime(s) : value.start;
    var endText = "now";
    if (value.end.isNotEmpty) {
      final e = DateTime.tryParse(value.end);
      endText = e != null ? _formatDateTime(e) : value.end;
    }
    return "$startText → $endText";
  }

  Future<void> _open(BuildContext context) async {
    final result = await showDialog<TimeRange>(
      context: context,
      builder: (context) => _TimeRangeDialog(initial: value),
    );
    if (result != null) onChange(result);
  }

  @override
  Widget build(BuildContext context) {
    return Material(
      color: Colors.transparent,
      child: InkWell(
        borderRadius: BorderRadius.circular(AppRadius.md),
        onTap: () => _open(context),
        child: Container(
          height: 32,
          padding: const EdgeInsets.symmetric(horizontal: AppSpacing.sm),
          decoration: BoxDecoration(
            color: Colors.black.withValues(alpha: 0.4),
            border: Border.all(color: AppColors.border.withValues(alpha: 0.4)),
            borderRadius: BorderRadius.circular(AppRadius.md),
          ),
          child: Row(
            mainAxisSize: MainAxisSize.min,
            children: [
              const Icon(Icons.access_time, size: 14, color: AppColors.textMuted),
              const SizedBox(width: AppSpacing.xs),
              ConstrainedBox(
                constraints: const BoxConstraints(maxWidth: 280),
                child: Text(
                  _displayText,
                  overflow: TextOverflow.ellipsis,
                  style: AppTypography.body.copyWith(fontSize: 12, color: AppColors.textSecondary),
                ),
              ),
            ],
          ),
        ),
      ),
    );
  }
}

// ── Dialog ──────────────────────────────────────────────────────────────

class _TimeRangeDialog extends StatefulWidget {
  const _TimeRangeDialog({required this.initial});
  final TimeRange initial;

  @override
  State<_TimeRangeDialog> createState() => _TimeRangeDialogState();
}

class _TimeRangeDialogState extends State<_TimeRangeDialog> {
  DateTime? _from;
  DateTime? _to;
  late int _startH;
  late int _startM;
  late int _startS;
  late int _endH;
  late int _endM;
  late int _endS;

  @override
  void initState() {
    super.initState();
    final start = widget.initial.start.isNotEmpty ? DateTime.tryParse(widget.initial.start) : null;
    final end = widget.initial.end.isNotEmpty ? DateTime.tryParse(widget.initial.end) : null;
    _from = start != null ? _dateOnly(start) : null;
    _to = end != null ? _dateOnly(end) : null;
    final now = DateTime.now();
    _startH = start?.hour ?? 0;
    _startM = start?.minute ?? 0;
    _startS = start?.second ?? 0;
    _endH = end?.hour ?? now.hour;
    _endM = end?.minute ?? now.minute;
    _endS = end?.second ?? now.second;
  }

  bool get _hasEndDate => _to != null;

  Widget _themed(BuildContext context, Widget? child) {
    return Theme(
      data: Theme.of(context).copyWith(
        colorScheme: Theme.of(context).colorScheme.copyWith(
          primary: AppColors.primary,
          onPrimary: AppColors.textInverse,
          surface: AppColors.bgSurface,
          onSurface: AppColors.textPrimary,
        ),
      ),
      child: child!,
    );
  }

  Future<void> _pickStart() async {
    final now = DateTime.now();
    final picked = await showDatePicker(
      context: context,
      initialDate: _from ?? now,
      firstDate: DateTime(now.year - 5),
      lastDate: DateTime(now.year + 1),
      builder: _themed,
    );
    if (picked != null) {
      setState(() {
        _from = picked;
        if (_to != null && _to!.isBefore(_from!)) _to = null;
      });
    }
  }

  Future<void> _pickEnd() async {
    final now = DateTime.now();
    final first = _from ?? DateTime(now.year - 5);
    final picked = await showDatePicker(
      context: context,
      initialDate: _to ?? (first.isAfter(now) ? first : now),
      firstDate: first,
      lastDate: DateTime(now.year + 1),
      builder: _themed,
    );
    if (picked != null) setState(() => _to = picked);
  }

  void _applyPreset(_Preset preset) {
    final start = preset.getStart(DateTime.now());
    Navigator.of(
      context,
    ).pop(TimeRange(start: _toNominalIso(start), end: "", label: preset.label));
  }

  void _reset() {
    Navigator.of(context).pop(const TimeRange(start: "", end: ""));
  }

  void _apply() {
    final from = _from;
    if (from == null) return;
    final start = DateTime(from.year, from.month, from.day, _startH, _startM, _startS);
    var endStr = "";
    if (_to != null) {
      final end = DateTime(_to!.year, _to!.month, _to!.day, _endH, _endM, _endS);
      endStr = _toNominalIso(end);
    }
    Navigator.of(context).pop(TimeRange(start: _toNominalIso(start), end: endStr));
  }

  @override
  Widget build(BuildContext context) {
    return Dialog(
      backgroundColor: AppColors.bgSurface,
      shape: RoundedRectangleBorder(
        borderRadius: BorderRadius.circular(AppRadius.lg),
        side: BorderSide(color: AppColors.border.withValues(alpha: 0.4)),
      ),
      child: ConstrainedBox(
        constraints: const BoxConstraints(maxWidth: 540),
        child: Padding(
          padding: const EdgeInsets.all(AppSpacing.md),
          child: Column(
            mainAxisSize: MainAxisSize.min,
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              Text("Time Range", style: AppTypography.h2),
              const SizedBox(height: AppSpacing.md),
              Row(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  SizedBox(
                    width: 150,
                    child: Column(
                      crossAxisAlignment: CrossAxisAlignment.start,
                      mainAxisSize: MainAxisSize.min,
                      children: [
                        Padding(
                          padding: const EdgeInsets.symmetric(horizontal: AppSpacing.sm),
                          child: Text(
                            "QUICK SELECT",
                            style: AppTypography.labelCaps.copyWith(
                              fontSize: 9,
                              color: AppColors.textMuted,
                            ),
                          ),
                        ),
                        const SizedBox(height: 6),
                        for (final p in _presets)
                          _DialogButton(label: p.label, onTap: () => _applyPreset(p)),
                        const Divider(height: 20),
                        _DialogButton(
                          label: "Reset (All Time)",
                          icon: Icons.restart_alt,
                          onTap: _reset,
                        ),
                      ],
                    ),
                  ),
                  const SizedBox(width: AppSpacing.md),
                  Expanded(
                    child: Column(
                      crossAxisAlignment: CrossAxisAlignment.start,
                      mainAxisSize: MainAxisSize.min,
                      children: [
                        Text(
                          "RANGE SELECTION",
                          style: AppTypography.labelCaps.copyWith(
                            fontSize: 9,
                            color: AppColors.textMuted,
                          ),
                        ),
                        const SizedBox(height: AppSpacing.sm),
                        Row(
                          children: [
                            Expanded(
                              child: OutlinedButton(
                                onPressed: _pickStart,
                                child: Text(
                                  _from == null ? "Pick start date" : _formatDateOnly(_from!),
                                  overflow: TextOverflow.ellipsis,
                                ),
                              ),
                            ),
                            const SizedBox(width: AppSpacing.xs),
                            Expanded(
                              child: OutlinedButton(
                                onPressed: _from == null ? null : _pickEnd,
                                child: Text(
                                  _to == null ? "No end (streaming)" : _formatDateOnly(_to!),
                                  overflow: TextOverflow.ellipsis,
                                ),
                              ),
                            ),
                            if (_to != null)
                              IconButton(
                                icon: const Icon(Icons.close, size: 14),
                                tooltip: "Clear end date",
                                color: AppColors.textMuted,
                                onPressed: () => setState(() => _to = null),
                              ),
                          ],
                        ),
                        const SizedBox(height: AppSpacing.md),
                        _TimeRow(
                          label: "Start",
                          h: _startH,
                          m: _startM,
                          s: _startS,
                          onH: (v) => setState(() => _startH = v),
                          onM: (v) => setState(() => _startM = v),
                          onS: (v) => setState(() => _startS = v),
                        ),
                        const SizedBox(height: AppSpacing.sm),
                        _TimeRow(
                          label: _hasEndDate ? "End" : "End (pick date)",
                          h: _endH,
                          m: _endM,
                          s: _endS,
                          onH: (v) => setState(() => _endH = v),
                          onM: (v) => setState(() => _endM = v),
                          onS: (v) => setState(() => _endS = v),
                          disabled: !_hasEndDate,
                        ),
                      ],
                    ),
                  ),
                ],
              ),
              const SizedBox(height: AppSpacing.md),
              Row(
                mainAxisAlignment: MainAxisAlignment.end,
                children: [
                  TextButton(
                    onPressed: () => Navigator.of(context).pop(),
                    child: const Text("Cancel"),
                  ),
                  const SizedBox(width: AppSpacing.sm),
                  ElevatedButton(
                    onPressed: _from == null ? null : _apply,
                    child: const Text("Set Window"),
                  ),
                ],
              ),
            ],
          ),
        ),
      ),
    );
  }
}

class _DialogButton extends StatelessWidget {
  const _DialogButton({required this.label, required this.onTap, this.icon});

  final String label;
  final VoidCallback onTap;
  final IconData? icon;

  @override
  Widget build(BuildContext context) {
    return Material(
      color: Colors.transparent,
      child: InkWell(
        borderRadius: BorderRadius.circular(AppRadius.sm),
        onTap: onTap,
        child: Padding(
          padding: const EdgeInsets.symmetric(horizontal: AppSpacing.sm, vertical: 6),
          child: Row(
            children: [
              if (icon != null) ...[
                Icon(icon, size: 12, color: AppColors.textMuted),
                const SizedBox(width: 6),
              ],
              Expanded(
                child: Text(
                  label,
                  style: AppTypography.body.copyWith(fontSize: 12, color: AppColors.textSecondary),
                ),
              ),
            ],
          ),
        ),
      ),
    );
  }
}

class _TimeSegment extends StatelessWidget {
  const _TimeSegment({
    required this.value,
    required this.max,
    required this.onChanged,
    this.disabled = false,
  });

  final int value;
  final int max;
  final ValueChanged<int> onChanged;
  final bool disabled;

  int _clamp(int v) => v.clamp(0, max);

  @override
  Widget build(BuildContext context) {
    return Column(
      mainAxisSize: MainAxisSize.min,
      children: [
        IconButton(
          icon: const Icon(Icons.keyboard_arrow_up, size: 14),
          padding: EdgeInsets.zero,
          constraints: const BoxConstraints(minWidth: 22, minHeight: 16),
          color: AppColors.textMuted,
          onPressed: disabled ? null : () => onChanged(_clamp(value + 1)),
        ),
        Container(
          width: 28,
          height: 24,
          alignment: Alignment.center,
          decoration: BoxDecoration(
            color: Colors.black.withValues(alpha: 0.4),
            border: Border.all(color: AppColors.border.withValues(alpha: 0.3)),
            borderRadius: BorderRadius.circular(AppRadius.sm),
          ),
          child: Text(
            _pad2(value),
            style: AppTypography.log.copyWith(
              fontSize: 12,
              fontWeight: FontWeight.w600,
              color: disabled ? AppColors.textMuted : AppColors.textPrimary,
            ),
          ),
        ),
        IconButton(
          icon: const Icon(Icons.keyboard_arrow_down, size: 14),
          padding: EdgeInsets.zero,
          constraints: const BoxConstraints(minWidth: 22, minHeight: 16),
          color: AppColors.textMuted,
          onPressed: disabled ? null : () => onChanged(_clamp(value - 1)),
        ),
      ],
    );
  }
}

class _TimeRow extends StatelessWidget {
  const _TimeRow({
    required this.label,
    required this.h,
    required this.m,
    required this.s,
    required this.onH,
    required this.onM,
    required this.onS,
    this.disabled = false,
  });

  final String label;
  final int h;
  final int m;
  final int s;
  final ValueChanged<int> onH;
  final ValueChanged<int> onM;
  final ValueChanged<int> onS;
  final bool disabled;

  @override
  Widget build(BuildContext context) {
    return Opacity(
      opacity: disabled ? 0.4 : 1,
      child: IgnorePointer(
        ignoring: disabled,
        child: Row(
          children: [
            SizedBox(
              width: 96,
              child: Text(
                label,
                style: AppTypography.body.copyWith(fontSize: 11, color: AppColors.textSecondary),
              ),
            ),
            _TimeSegment(value: h, max: 23, onChanged: onH, disabled: disabled),
            _Colon(),
            _TimeSegment(value: m, max: 59, onChanged: onM, disabled: disabled),
            _Colon(),
            _TimeSegment(value: s, max: 59, onChanged: onS, disabled: disabled),
          ],
        ),
      ),
    );
  }
}

class _Colon extends StatelessWidget {
  const _Colon();

  @override
  Widget build(BuildContext context) {
    return Padding(
      padding: const EdgeInsets.symmetric(horizontal: 2),
      child: Text(
        ":",
        style: AppTypography.body.copyWith(
          fontWeight: FontWeight.w700,
          color: AppColors.textMuted,
        ),
      ),
    );
  }
}
