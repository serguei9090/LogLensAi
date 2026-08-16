/// Dart port of `src/components/molecules/AddColumnModal.tsx`.
///
/// Dialog for defining a custom regex-derived table column: a name, a
/// regex (capture group 1, or the whole match if there's no group, becomes
/// the cell value), and a preset width. Shows a live preview against
/// sample raw log lines as the user types the regex.
///
/// Kept dumb like `ConfirmationDialog`: the plain constructor takes
/// [sampleLogs] directly rather than fetching them itself, so it has no
/// dependency on `SidecarBridge`/Riverpod and is trivially widget-testable.
/// [AddColumnModal.show] is the batteries-included call-site helper that
/// awaits [fetchSamples] and wraps [showDialog].
library;

import "package:flutter/material.dart";

import "../../models/ui_column.dart";
import "../../theme/app_theme.dart";

const List<({String value, String label})> _kWidthOptions = [
  (value: "72px", label: "Tiny (72px)"),
  (value: "90px", label: "Small (90px)"),
  (value: "120px", label: "Medium (120px)"),
  (value: "160px", label: "Large (160px)"),
  (value: "200px", label: "X-Large (200px)"),
  (value: "260px", label: "Wide (260px)"),
];

class AddColumnModal extends StatefulWidget {
  const AddColumnModal({
    super.key,
    required this.onSave,
    this.onCancel,
    this.sampleLogs = const [],
    this.loadingSamples = false,
  });

  /// Fired with the finished column definition once "Add Column" is
  /// pressed with a valid name + regex.
  final ValueChanged<CustomColumnDef> onSave;
  final VoidCallback? onCancel;

  /// Up to ~10 random raw log lines from the active workspace/source, used
  /// to preview regex matches live. Supply via [show]'s `fetchSamples` in
  /// real call sites.
  final List<String> sampleLogs;
  final bool loadingSamples;

  /// Awaits [fetchSamples] then shows this dialog with the resolved
  /// samples, popping automatically on save/cancel.
  static Future<void> show(
    BuildContext context, {
    required Future<List<String>> Function() fetchSamples,
    required ValueChanged<CustomColumnDef> onSave,
  }) async {
    List<String> samples = const [];
    try {
      samples = await fetchSamples();
    } catch (_) {
      samples = const [];
    }
    if (!context.mounted) return;
    return showDialog<void>(
      context: context,
      builder: (dialogContext) => AddColumnModal(
        sampleLogs: samples,
        onSave: (col) {
          Navigator.of(dialogContext).pop();
          onSave(col);
        },
        onCancel: () => Navigator.of(dialogContext).pop(),
      ),
    );
  }

  @override
  State<AddColumnModal> createState() => _AddColumnModalState();
}

class _AddColumnModalState extends State<AddColumnModal> {
  final _labelController = TextEditingController();
  final _regexController = TextEditingController();
  String _width = "120px";
  String? _regexError;

  @override
  void dispose() {
    _labelController.dispose();
    _regexController.dispose();
    super.dispose();
  }

  List<({String raw, String? match})> get _preview {
    final regexText = _regexController.text.trim();
    if (regexText.isEmpty) {
      _regexError = null;
      return widget.sampleLogs.map((raw) => (raw: raw, match: null)).toList();
    }
    try {
      final re = RegExp(regexText);
      _regexError = null;
      return widget.sampleLogs.map((raw) {
        final m = re.firstMatch(raw);
        if (m == null) return (raw: raw, match: null);
        final group1 = m.groupCount >= 1 ? m.group(1) : null;
        return (raw: raw, match: group1 ?? m.group(0));
      }).toList();
    } catch (e) {
      _regexError = e.toString();
      return widget.sampleLogs.map((raw) => (raw: raw, match: null)).toList();
    }
  }

  void _handleSave() {
    final label = _labelController.text.trim();
    final regex = _regexController.text.trim();
    if (label.isEmpty || regex.isEmpty || _regexError != null) return;
    final id =
        "custom_${label.toLowerCase().replaceAll(RegExp(r"\s+"), "_")}_${DateTime.now().millisecondsSinceEpoch}";
    widget.onSave(
      CustomColumnDef(id: id, label: label, width: _width, source: "user", regex: regex),
    );
  }

  @override
  Widget build(BuildContext context) {
    final preview = _preview;
    final matchCount = preview.where((r) => r.match != null).length;
    final hasMatches = matchCount > 0;
    final regexText = _regexController.text.trim();

    return Dialog(
      backgroundColor: AppColors.bgSurface,
      shape: RoundedRectangleBorder(
        borderRadius: BorderRadius.circular(AppRadius.lg),
        side: const BorderSide(color: AppColors.border),
      ),
      child: ConstrainedBox(
        constraints: const BoxConstraints(maxWidth: 640, maxHeight: 640),
        child: Padding(
          padding: const EdgeInsets.all(AppSpacing.lg),
          child: Column(
            mainAxisSize: MainAxisSize.min,
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              Row(
                children: [
                  const Icon(Icons.add, size: 16, color: AppColors.primary),
                  const SizedBox(width: AppSpacing.xs),
                  Text("Add Custom Column", style: AppTypography.h1.copyWith(fontSize: 18)),
                ],
              ),
              const SizedBox(height: AppSpacing.xs),
              Text(
                "Define a regex to extract a value from each log line and display it as a "
                "new column. Group 1 is used as the cell value.",
                style: AppTypography.body.copyWith(color: AppColors.textMuted, fontSize: 13),
              ),
              const SizedBox(height: AppSpacing.md),
              Flexible(
                child: SingleChildScrollView(
                  child: Column(
                    crossAxisAlignment: CrossAxisAlignment.start,
                    children: [
                      _FieldLabel("Column Name"),
                      TextField(
                        controller: _labelController,
                        decoration: const InputDecoration(hintText: "e.g. User Agent"),
                        onChanged: (_) => setState(() {}),
                      ),
                      const SizedBox(height: AppSpacing.sm),
                      _FieldLabel("Column Width"),
                      DropdownButtonFormField<String>(
                        initialValue: _width,
                        dropdownColor: AppColors.bgSurface,
                        items: _kWidthOptions
                            .map((o) => DropdownMenuItem(value: o.value, child: Text(o.label)))
                            .toList(),
                        onChanged: (v) => setState(() => _width = v ?? _width),
                      ),
                      const SizedBox(height: AppSpacing.sm),
                      _FieldLabel("Regex Pattern"),
                      TextField(
                        controller: _regexController,
                        maxLines: 2,
                        style: AppTypography.monoBody.copyWith(fontSize: 13),
                        decoration: InputDecoration(
                          hintText: r'e.g. "([^"]+)"$   or   \s(\d{3})\s',
                          errorText: _regexError,
                        ),
                        onChanged: (_) => setState(() {}),
                      ),
                      const SizedBox(height: AppSpacing.md),
                      Row(
                        mainAxisAlignment: MainAxisAlignment.spaceBetween,
                        children: [
                          Text(
                            "Preview (10 random lines)",
                            style: AppTypography.labelCaps,
                          ),
                          if (regexText.isNotEmpty && _regexError == null)
                            Row(
                              mainAxisSize: MainAxisSize.min,
                              children: [
                                Icon(
                                  hasMatches ? Icons.check_circle : Icons.error_outline,
                                  size: 12,
                                  color: hasMatches ? AppColors.primary : AppColors.textMuted,
                                ),
                                const SizedBox(width: 4),
                                Text(
                                  "$matchCount/${widget.sampleLogs.length} matches",
                                  style: TextStyle(
                                    fontSize: 11,
                                    color: hasMatches ? AppColors.primary : AppColors.textMuted,
                                  ),
                                ),
                              ],
                            ),
                        ],
                      ),
                      const SizedBox(height: AppSpacing.xs),
                      Container(
                        constraints: const BoxConstraints(maxHeight: 220),
                        decoration: BoxDecoration(
                          color: AppColors.bgBase,
                          border: Border.all(color: AppColors.border),
                          borderRadius: BorderRadius.circular(AppRadius.md),
                        ),
                        child: widget.loadingSamples
                            ? const Padding(
                                padding: EdgeInsets.all(AppSpacing.lg),
                                child: Center(
                                  child: SizedBox(
                                    width: 16,
                                    height: 16,
                                    child: CircularProgressIndicator(strokeWidth: 2),
                                  ),
                                ),
                              )
                            : widget.sampleLogs.isEmpty
                            ? Padding(
                                padding: const EdgeInsets.all(AppSpacing.lg),
                                child: Text(
                                  "No logs available in this workspace.",
                                  textAlign: TextAlign.center,
                                  style: AppTypography.body.copyWith(color: AppColors.textMuted, fontSize: 13),
                                ),
                              )
                            : ListView.separated(
                                shrinkWrap: true,
                                itemCount: preview.length,
                                separatorBuilder: (_, _) =>
                                    const Divider(height: 1, color: AppColors.borderMuted),
                                itemBuilder: (context, i) {
                                  final row = preview[i];
                                  return Padding(
                                    padding: const EdgeInsets.symmetric(
                                      horizontal: AppSpacing.sm,
                                      vertical: 6,
                                    ),
                                    child: Column(
                                      crossAxisAlignment: CrossAxisAlignment.start,
                                      children: [
                                        Text(
                                          row.raw,
                                          style: AppTypography.log.copyWith(
                                            fontSize: 11,
                                            color: AppColors.textMuted,
                                          ),
                                        ),
                                        if (row.match != null)
                                          Padding(
                                            padding: const EdgeInsets.only(top: 2),
                                            child: Text(
                                              "→ ${row.match}",
                                              style: AppTypography.log.copyWith(
                                                fontSize: 11,
                                                color: AppColors.primary,
                                              ),
                                            ),
                                          )
                                        else if (regexText.isNotEmpty && _regexError == null)
                                          Padding(
                                            padding: const EdgeInsets.only(top: 2),
                                            child: Text(
                                              "→ no match",
                                              style: AppTypography.log.copyWith(
                                                fontSize: 11,
                                                color: AppColors.textMuted.withValues(alpha: 0.4),
                                              ),
                                            ),
                                          ),
                                      ],
                                    ),
                                  );
                                },
                              ),
                      ),
                    ],
                  ),
                ),
              ),
              const SizedBox(height: AppSpacing.md),
              Row(
                mainAxisAlignment: MainAxisAlignment.end,
                children: [
                  TextButton(
                    onPressed: widget.onCancel,
                    child: const Text("Cancel"),
                  ),
                  const SizedBox(width: AppSpacing.sm),
                  ElevatedButton.icon(
                    onPressed:
                        (_labelController.text.trim().isEmpty ||
                            _regexController.text.trim().isEmpty ||
                            _regexError != null)
                        ? null
                        : _handleSave,
                    icon: const Icon(Icons.add, size: 16),
                    label: const Text("Add Column"),
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

class _FieldLabel extends StatelessWidget {
  const _FieldLabel(this.text);
  final String text;

  @override
  Widget build(BuildContext context) {
    return Padding(
      padding: const EdgeInsets.only(bottom: 4),
      child: Text(text, style: AppTypography.labelCaps),
    );
  }
}
