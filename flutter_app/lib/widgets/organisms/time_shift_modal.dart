/// Dart port of `src/components/organisms/TimeShiftModal.tsx`.
///
/// Modal for computing a per-source clock-offset ("temporal sync"): either a
/// manual Days/Hours/Mins/Secs offset with an Add/Subtract direction, or a
/// "Visual Sync" mode where the user pastes an inbound and target timestamp
/// and the offset is derived from their difference. On Apply, reports the
/// signed offset in seconds via [onSaved] (matching the React
/// `onSaved: (seconds: number) => void` contract used by `OrchestratorHub`'s
/// temporal-offsets flow).
library;

import "package:flutter/material.dart";

import "../../theme/app_theme.dart";

class TimeShiftModal extends StatefulWidget {
  const TimeShiftModal({
    super.key,
    required this.sourceLabel,
    required this.initialShiftSeconds,
    required this.onSaved,
  });

  final String sourceLabel;

  /// Current offset in seconds (may be negative).
  final int initialShiftSeconds;
  final ValueChanged<int> onSaved;

  /// Convenience wrapper matching this batch's other `.show()` dialog
  /// helpers -- opens the modal via [showDialog] and forwards to [onSaved].
  static Future<void> show(
    BuildContext context, {
    required String sourceLabel,
    required int initialShiftSeconds,
    required ValueChanged<int> onSaved,
  }) {
    return showDialog<void>(
      context: context,
      builder: (context) => TimeShiftModal(
        sourceLabel: sourceLabel,
        initialShiftSeconds: initialShiftSeconds,
        onSaved: onSaved,
      ),
    );
  }

  @override
  State<TimeShiftModal> createState() => _TimeShiftModalState();
}

enum _ShiftMode { relative, sample }

class _TimeShiftModalState extends State<TimeShiftModal> {
  _ShiftMode _mode = _ShiftMode.relative;

  late int _days;
  late int _hours;
  late int _mins;
  late int _secs;
  late bool _isNegative;

  final _originalTsController = TextEditingController();
  final _targetTsController = TextEditingController();
  String? _sampleError;

  @override
  void initState() {
    super.initState();
    final total = widget.initialShiftSeconds.abs();
    _isNegative = widget.initialShiftSeconds < 0;
    _days = total ~/ (24 * 3600);
    _hours = (total % (24 * 3600)) ~/ 3600;
    _mins = (total % 3600) ~/ 60;
    _secs = total % 60;
  }

  @override
  void dispose() {
    _originalTsController.dispose();
    _targetTsController.dispose();
    super.dispose();
  }

  int get _calculatedTotal => _days * 24 * 3600 + _hours * 3600 + _mins * 60 + _secs;

  String get _formattedShift {
    if (_calculatedTotal == 0) return "0s";
    return "${_isNegative ? '-' : '+'}${_calculatedTotal}s";
  }

  void _apply() {
    if (_mode == _ShiftMode.relative) {
      final total = _isNegative ? -_calculatedTotal : _calculatedTotal;
      widget.onSaved(total);
      Navigator.of(context).pop();
      return;
    }

    final d1 = DateTime.tryParse(_originalTsController.text.trim().replaceFirst(" ", "T"));
    final d2 = DateTime.tryParse(_targetTsController.text.trim().replaceFirst(" ", "T"));
    if (d1 == null || d2 == null) {
      setState(() => _sampleError = "Invalid timestamp format. Use YYYY-MM-DD HH:MM:SS");
      return;
    }
    final total = d2.difference(d1).inSeconds;
    widget.onSaved(total);
    Navigator.of(context).pop();
  }

  @override
  Widget build(BuildContext context) {
    return Dialog(
      backgroundColor: AppColors.bgTooltip,
      shape: RoundedRectangleBorder(
        borderRadius: BorderRadius.circular(AppRadius.xl),
        side: const BorderSide(color: AppColors.borderSubtle),
      ),
      child: ConstrainedBox(
        constraints: const BoxConstraints(maxWidth: 420),
        child: Column(
          mainAxisSize: MainAxisSize.min,
          children: [
            Padding(
              padding: const EdgeInsets.all(AppSpacing.lg),
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                mainAxisSize: MainAxisSize.min,
                children: [
                  Row(
                    children: [
                      Container(
                        padding: const EdgeInsets.all(8),
                        decoration: BoxDecoration(
                          color: Colors.white.withValues(alpha: 0.05),
                          border: Border.all(color: Colors.white.withValues(alpha: 0.1)),
                          borderRadius: BorderRadius.circular(AppRadius.sm),
                        ),
                        child: const Icon(Icons.access_time, size: 20, color: AppColors.textSecondary),
                      ),
                      const SizedBox(width: AppSpacing.sm),
                      Expanded(
                        child: Column(
                          crossAxisAlignment: CrossAxisAlignment.start,
                          mainAxisSize: MainAxisSize.min,
                          children: [
                            Text("Time Alignment", style: AppTypography.h1.copyWith(fontSize: 18)),
                            const SizedBox(height: 2),
                            Row(
                              children: [
                                Text(
                                  "Target:",
                                  style: AppTypography.body.copyWith(fontSize: 11, color: AppColors.textMuted),
                                ),
                                const SizedBox(width: 6),
                                Flexible(
                                  child: Container(
                                    padding: const EdgeInsets.symmetric(horizontal: 6, vertical: 2),
                                    decoration: BoxDecoration(
                                      color: Colors.white.withValues(alpha: 0.05),
                                      border: Border.all(color: Colors.white.withValues(alpha: 0.1)),
                                      borderRadius: BorderRadius.circular(4),
                                    ),
                                    child: Text(
                                      widget.sourceLabel,
                                      overflow: TextOverflow.ellipsis,
                                      style: AppTypography.log.copyWith(fontSize: 11, color: AppColors.textSecondary),
                                    ),
                                  ),
                                ),
                              ],
                            ),
                          ],
                        ),
                      ),
                    ],
                  ),
                  const SizedBox(height: AppSpacing.lg),
                  _ModeTabs(
                    mode: _mode,
                    onChanged: (m) => setState(() => _mode = m),
                  ),
                  const SizedBox(height: AppSpacing.lg),
                  if (_mode == _ShiftMode.relative) _relativeMode() else _sampleMode(),
                ],
              ),
            ),
            Container(
              padding: const EdgeInsets.symmetric(horizontal: AppSpacing.lg, vertical: AppSpacing.md),
              decoration: const BoxDecoration(
                color: Color(0x05FFFFFF),
                border: Border(top: BorderSide(color: AppColors.border)),
              ),
              child: Row(
                mainAxisAlignment: MainAxisAlignment.end,
                children: [
                  TextButton(
                    onPressed: () => Navigator.of(context).pop(),
                    child: const Text("Cancel"),
                  ),
                  const SizedBox(width: AppSpacing.sm),
                  ElevatedButton(onPressed: _apply, child: const Text("Apply")),
                ],
              ),
            ),
          ],
        ),
      ),
    );
  }

  Widget _relativeMode() {
    return Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      mainAxisSize: MainAxisSize.min,
      children: [
        Row(
          children: [
            Expanded(child: _unitField("Days", _days, (v) => setState(() => _days = v))),
            const SizedBox(width: AppSpacing.xs),
            Expanded(child: _unitField("Hours", _hours, (v) => setState(() => _hours = v))),
            const SizedBox(width: AppSpacing.xs),
            Expanded(child: _unitField("Mins", _mins, (v) => setState(() => _mins = v))),
            const SizedBox(width: AppSpacing.xs),
            Expanded(child: _unitField("Secs", _secs, (v) => setState(() => _secs = v))),
          ],
        ),
        const SizedBox(height: AppSpacing.lg),
        Text(
          "SHIFT DIRECTION",
          style: AppTypography.labelCaps.copyWith(fontSize: 10, color: AppColors.textMuted),
        ),
        const SizedBox(height: 6),
        Container(
          padding: const EdgeInsets.all(4),
          decoration: BoxDecoration(
            color: Colors.white.withValues(alpha: 0.05),
            border: Border.all(color: Colors.white.withValues(alpha: 0.1)),
            borderRadius: BorderRadius.circular(AppRadius.md),
          ),
          child: Row(
            children: [
              Expanded(child: _directionButton("Add", !_isNegative, () => setState(() => _isNegative = false))),
              Expanded(child: _directionButton("Subtract", _isNegative, () => setState(() => _isNegative = true))),
            ],
          ),
        ),
        const SizedBox(height: AppSpacing.md),
        Container(
          padding: const EdgeInsets.only(top: AppSpacing.sm),
          decoration: const BoxDecoration(
            border: Border(top: BorderSide(color: AppColors.border)),
          ),
          child: Row(
            mainAxisAlignment: MainAxisAlignment.spaceBetween,
            children: [
              Text(
                "CALCULATED SHIFT",
                style: AppTypography.labelCaps.copyWith(fontSize: 10, color: AppColors.textMuted),
              ),
              Text(
                _formattedShift,
                style: AppTypography.log.copyWith(fontSize: 14, color: AppColors.textPrimary),
              ),
            ],
          ),
        ),
      ],
    );
  }

  Widget _unitField(String label, int value, ValueChanged<int> onChanged) {
    return Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      mainAxisSize: MainAxisSize.min,
      children: [
        Text(
          label.toUpperCase(),
          style: AppTypography.labelCaps.copyWith(fontSize: 9, color: AppColors.textMuted),
        ),
        const SizedBox(height: 4),
        TextFormField(
          key: ValueKey("$label-$value"),
          initialValue: value.toString(),
          keyboardType: TextInputType.number,
          textAlign: TextAlign.center,
          style: AppTypography.log.copyWith(fontSize: 13),
          decoration: const InputDecoration(isDense: true, contentPadding: EdgeInsets.symmetric(vertical: 10)),
          onChanged: (v) => onChanged((int.tryParse(v) ?? 0).clamp(0, 1 << 30)),
        ),
      ],
    );
  }

  Widget _directionButton(String label, bool selected, VoidCallback onTap) {
    return Material(
      color: selected ? Colors.white.withValues(alpha: 0.1) : Colors.transparent,
      borderRadius: BorderRadius.circular(6),
      child: InkWell(
        onTap: onTap,
        borderRadius: BorderRadius.circular(6),
        child: Padding(
          padding: const EdgeInsets.symmetric(vertical: 8),
          child: Center(
            child: Text(
              label,
              style: AppTypography.body.copyWith(
                fontSize: 11,
                fontWeight: FontWeight.w600,
                color: selected ? AppColors.textPrimary : AppColors.textMuted,
              ),
            ),
          ),
        ),
      ),
    );
  }

  Widget _sampleMode() {
    return Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      mainAxisSize: MainAxisSize.min,
      children: [
        Container(
          padding: const EdgeInsets.all(AppSpacing.sm),
          decoration: BoxDecoration(
            color: Colors.white.withValues(alpha: 0.05),
            border: Border.all(color: Colors.white.withValues(alpha: 0.1)),
            borderRadius: BorderRadius.circular(AppRadius.md),
          ),
          child: Row(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              const Icon(Icons.help_outline, size: 16, color: AppColors.textMuted),
              const SizedBox(width: AppSpacing.sm),
              Expanded(
                child: Text(
                  "Paste a timestamp and specify the desired target time. We'll calculate the offset "
                  "automatically.",
                  style: AppTypography.body.copyWith(fontSize: 11, color: AppColors.textSecondary),
                ),
              ),
            ],
          ),
        ),
        const SizedBox(height: AppSpacing.md),
        Text(
          "INBOUND TIME (YYYY-MM-DD HH:MM:SS)",
          style: AppTypography.labelCaps.copyWith(fontSize: 9, color: AppColors.textMuted),
        ),
        const SizedBox(height: 4),
        TextField(
          controller: _originalTsController,
          style: AppTypography.log.copyWith(fontSize: 13),
          decoration: const InputDecoration(isDense: true, hintText: "2024-05-25 00:00:21"),
          onChanged: (_) => setState(() => _sampleError = null),
        ),
        const SizedBox(height: AppSpacing.sm),
        Text(
          "TARGET SYNCHRONIZED TIME",
          style: AppTypography.labelCaps.copyWith(fontSize: 9, color: AppColors.textMuted),
        ),
        const SizedBox(height: 4),
        TextField(
          controller: _targetTsController,
          style: AppTypography.log.copyWith(fontSize: 13),
          decoration: const InputDecoration(isDense: true, hintText: "2024-05-25 02:00:00"),
          onChanged: (_) => setState(() => _sampleError = null),
        ),
        if (_sampleError != null) ...[
          const SizedBox(height: 6),
          Text(_sampleError!, style: AppTypography.body.copyWith(fontSize: 11, color: AppColors.error)),
        ],
      ],
    );
  }
}

class _ModeTabs extends StatelessWidget {
  const _ModeTabs({required this.mode, required this.onChanged});

  final _ShiftMode mode;
  final ValueChanged<_ShiftMode> onChanged;

  @override
  Widget build(BuildContext context) {
    return Container(
      padding: const EdgeInsets.all(4),
      decoration: BoxDecoration(
        color: Colors.white.withValues(alpha: 0.05),
        border: Border.all(color: Colors.white.withValues(alpha: 0.1)),
        borderRadius: BorderRadius.circular(AppRadius.md),
      ),
      child: Row(
        children: [
          Expanded(child: _tab("Manual Offset", _ShiftMode.relative)),
          Expanded(child: _tab("Visual Sync", _ShiftMode.sample)),
        ],
      ),
    );
  }

  Widget _tab(String label, _ShiftMode value) {
    final selected = mode == value;
    return Material(
      color: selected ? Colors.white.withValues(alpha: 0.1) : Colors.transparent,
      borderRadius: BorderRadius.circular(6),
      child: InkWell(
        onTap: () => onChanged(value),
        borderRadius: BorderRadius.circular(6),
        child: Padding(
          padding: const EdgeInsets.symmetric(vertical: 8),
          child: Center(
            child: Text(
              label,
              style: AppTypography.body.copyWith(
                fontSize: 11,
                fontWeight: FontWeight.w600,
                color: selected ? AppColors.textPrimary : AppColors.textMuted,
              ),
            ),
          ),
        ),
      ),
    );
  }
}
