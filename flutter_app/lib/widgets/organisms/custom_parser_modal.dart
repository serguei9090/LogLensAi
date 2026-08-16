/// Dart port of `src/components/organisms/CustomParserModal.tsx`.
///
/// Full-screen "Parser Architect" overlay: a per-source custom log-parser
/// regex editor with raw sample lines and a live extraction preview.
///
/// Deviation from the React source: the React version's headline feature is
/// "highlight text in a sample line to open a floating Map
/// Timestamp/Severity menu", implemented via `window.getSelection()` +
/// `Range.getBoundingClientRect()` to translate a raw DOM text selection
/// into `{start, end}` character offsets, then synthesizing a regex from
/// the resulting offset ranges. Flutter has no equivalent
/// selection-to-character-offset API exposed by [SelectableText] (no
/// `onSelectionChanged` callback gives a floating-toolbar-ready screen
/// rect, and text selection here doesn't cross unrelated sibling widgets
/// the way a DOM `Range` can), and reimplementing that whole flow (custom
/// gesture detection + geometry) is out of scope for this organism pass.
/// This port keeps the two genuinely load-bearing pieces -- a regex editor
/// with live per-line preview against real sample data, and Python-style
/// `(?P<name>...)` named-group syntax -- and replaces the drag-to-map UI
/// with "Insert `(?P<timestamp>...)`" / "Insert `(?P<level>...)`" quick
/// -insert buttons that splice the same named-group syntax into the regex
/// field at the cursor. This is a smaller interaction than the React
/// version but reaches the same end state (a working named-group regex)
/// without needing DOM-only selection APIs.
///
/// Named-group syntax note: Dart's [RegExp] natively supports named
/// captures via `(?<name>...)` (see [RegExpMatch.namedGroup]), so unlike
/// the React source (which converts `(?P<name>...)` to indexed groups for
/// JS's older named-group support), this port converts Python's
/// `(?P<name>...)` to Dart's native `(?<name>...)` and reads matches by
/// name directly.
library;

import "package:flutter/material.dart";
import "package:flutter_riverpod/flutter_riverpod.dart";

import "../../providers/workspace_provider.dart";
import "../../theme/app_theme.dart";

class _PreviewRow {
  const _PreviewRow({this.timestamp, this.level});
  final String? timestamp;
  final String? level;
}

class CustomParserModal extends ConsumerStatefulWidget {
  const CustomParserModal({
    super.key,
    required this.workspaceId,
    required this.sourceId,
    required this.isOpen,
    required this.onClose,
    required this.onSaved,
    this.initialConfig,
  });

  final String workspaceId;
  final String sourceId;
  final bool isOpen;
  final VoidCallback onClose;

  /// Fired with the finished parser config (JSON-encoded
  /// `{"regex": "...", "mapping": {}}`, mirroring `ParserConfig` in the
  /// React source) once "Save Definition" is pressed.
  final ValueChanged<String> onSaved;

  /// Previously-saved config JSON, if any (prefills the regex field).
  final String? initialConfig;

  @override
  ConsumerState<CustomParserModal> createState() => _CustomParserModalState();
}

class _CustomParserModalState extends ConsumerState<CustomParserModal> {
  List<String> _samples = [];
  bool _isLoading = true;
  final _regexController = TextEditingController();
  List<_PreviewRow> _preview = [];
  String? _regexError;

  @override
  void initState() {
    super.initState();
    _regexController.addListener(_recomputePreview);
    if (widget.isOpen) {
      _load();
    }
  }

  @override
  void didUpdateWidget(covariant CustomParserModal oldWidget) {
    super.didUpdateWidget(oldWidget);
    if (widget.isOpen && !oldWidget.isOpen) {
      _load();
    }
  }

  @override
  void dispose() {
    _regexController.removeListener(_recomputePreview);
    _regexController.dispose();
    super.dispose();
  }

  Future<void> _load() async {
    setState(() => _isLoading = true);
    final samples = await ref
        .read(workspaceProvider.notifier)
        .getSampleLines(widget.workspaceId, widget.sourceId, limit: 15);
    if (!mounted) return;

    String initialRegex = "";
    final initialConfig = widget.initialConfig;
    if (initialConfig != null && initialConfig.isNotEmpty) {
      try {
        final decoded = _decodeConfig(initialConfig);
        initialRegex = decoded ?? "";
      } catch (_) {
        // Malformed config -- mirror React's console.warn-and-continue.
      }
    }

    setState(() {
      _samples = samples;
      _isLoading = false;
      _regexController.text = initialRegex;
    });
    _recomputePreview();
  }

  String? _decodeConfig(String json) {
    // Minimal hand-rolled extraction (avoids pulling in `dart:convert` just
    // for one field) -- looks for `"regex":"..."` in the JSON string.
    final match = RegExp(r'"regex"\s*:\s*"((?:[^"\\]|\\.)*)"').firstMatch(json);
    if (match == null) return null;
    return match
        .group(1)!
        .replaceAll(r'\"', '"')
        .replaceAll(r"\\", r"\");
  }

  void _insertSnippet(String snippet) {
    final selection = _regexController.selection;
    final text = _regexController.text;
    final insertAt = selection.isValid ? selection.start : text.length;
    final newText = text.replaceRange(insertAt, selection.isValid ? selection.end : insertAt, snippet);
    _regexController.value = TextEditingValue(
      text: newText,
      selection: TextSelection.collapsed(offset: insertAt + snippet.length),
    );
  }

  void _recomputePreview() {
    final pattern = _regexController.text;
    if (pattern.isEmpty) {
      setState(() {
        _preview = [];
        _regexError = null;
      });
      return;
    }
    try {
      // Python `(?P<name>...)` -> Dart native `(?<name>...)`.
      final dartPattern = pattern.replaceAllMapped(
        RegExp(r"\(\?P<(\w+)>"),
        (m) => "(?<${m[1]}>",
      );
      final re = RegExp(dartPattern);
      final rows = _samples.map((line) {
        final m = re.firstMatch(line);
        if (m == null) return const _PreviewRow(timestamp: "No match", level: "---");
        String? ts;
        String? lvl;
        try {
          ts = m.namedGroup("timestamp");
        } catch (_) {
          ts = null;
        }
        try {
          lvl = m.namedGroup("level");
        } catch (_) {
          lvl = null;
        }
        return _PreviewRow(
          timestamp: ts ?? m.group(0)?.substring(0, m.group(0)!.length.clamp(0, 20)),
          level: lvl ?? "INFO",
        );
      }).toList();
      setState(() {
        _preview = rows;
        _regexError = null;
      });
    } catch (e) {
      setState(() {
        _preview = [];
        _regexError = e.toString();
      });
    }
  }

  void _handleSave() {
    final regex = _regexController.text;
    final escaped = regex.replaceAll(r"\", r"\\").replaceAll('"', r'\"');
    widget.onSaved('{"regex":"$escaped","mapping":{}}');
    widget.onClose();
  }

  @override
  Widget build(BuildContext context) {
    if (!widget.isOpen) return const SizedBox.shrink();

    return Material(
      color: Colors.black.withValues(alpha: 0.85),
      child: Center(
        child: ConstrainedBox(
          constraints: const BoxConstraints(maxWidth: 1100, minHeight: 520),
          child: Container(
            margin: const EdgeInsets.all(AppSpacing.lg),
            decoration: BoxDecoration(
              color: AppColors.bgApp,
              borderRadius: BorderRadius.circular(AppRadius.xl),
              border: Border.all(color: AppColors.borderSubtle),
            ),
            clipBehavior: Clip.antiAlias,
            child: Column(
              mainAxisSize: MainAxisSize.min,
              children: [
                _header(),
                Expanded(
                  child: Row(
                    crossAxisAlignment: CrossAxisAlignment.stretch,
                    children: [
                      Expanded(flex: 3, child: _samplesPane()),
                      const VerticalDivider(width: 1),
                      Expanded(flex: 2, child: _editorPane()),
                    ],
                  ),
                ),
              ],
            ),
          ),
        ),
      ),
    );
  }

  Widget _header() {
    return Container(
      padding: const EdgeInsets.symmetric(horizontal: AppSpacing.lg, vertical: AppSpacing.md),
      decoration: BoxDecoration(
        color: Colors.white.withValues(alpha: 0.05),
        border: const Border(bottom: BorderSide(color: AppColors.borderSubtle)),
      ),
      child: Row(
        mainAxisAlignment: MainAxisAlignment.spaceBetween,
        children: [
          Row(
            children: [
              Container(
                padding: const EdgeInsets.all(AppSpacing.sm),
                decoration: BoxDecoration(
                  color: AppColors.primary.withValues(alpha: 0.1),
                  borderRadius: BorderRadius.circular(AppRadius.md),
                  border: Border.all(color: AppColors.primary.withValues(alpha: 0.2)),
                ),
                child: const Icon(Icons.terminal, size: 20, color: AppColors.primary),
              ),
              const SizedBox(width: AppSpacing.md),
              Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  Text("Parser Architect", style: AppTypography.h1),
                  const SizedBox(height: 2),
                  Text(
                    "LOG TRANSLATION ENGINE",
                    style: AppTypography.labelCaps.copyWith(fontSize: 10),
                  ),
                ],
              ),
            ],
          ),
          IconButton(
            icon: const Icon(Icons.close, size: 20),
            color: AppColors.textMuted,
            onPressed: widget.onClose,
          ),
        ],
      ),
    );
  }

  Widget _samplesPane() {
    return DecoratedBox(
      decoration: BoxDecoration(color: Colors.black.withValues(alpha: 0.2)),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.stretch,
        children: [
          Padding(
            padding: const EdgeInsets.all(AppSpacing.md),
            child: Row(
              children: [
                const Icon(Icons.search, size: 12, color: AppColors.textMuted),
                const SizedBox(width: AppSpacing.xs),
                Text("RAW SOURCE SAMPLES", style: AppTypography.labelCaps),
              ],
            ),
          ),
          const Divider(height: 1),
          Expanded(
            child: _isLoading
                ? const Center(
                    child: Text(
                      "Sampling log stream...",
                      style: TextStyle(color: AppColors.textMuted),
                    ),
                  )
                : _samples.isEmpty
                ? const Center(
                    child: Text(
                      "No samples found.",
                      style: TextStyle(color: AppColors.textMuted),
                    ),
                  )
                : ListView.separated(
                    itemCount: _samples.length,
                    separatorBuilder: (_, _) =>
                        Divider(height: 1, color: Colors.white.withValues(alpha: 0.05)),
                    itemBuilder: (context, i) {
                      return Row(
                        crossAxisAlignment: CrossAxisAlignment.start,
                        children: [
                          Container(
                            width: 48,
                            padding: const EdgeInsets.symmetric(vertical: AppSpacing.sm),
                            alignment: Alignment.center,
                            color: Colors.black.withValues(alpha: 0.4),
                            child: Text(
                              (i + 1).toString().padLeft(3, "0"),
                              style: AppTypography.log.copyWith(fontSize: 9, color: AppColors.textMuted),
                            ),
                          ),
                          Expanded(
                            child: Padding(
                              padding: const EdgeInsets.symmetric(
                                horizontal: AppSpacing.md,
                                vertical: AppSpacing.sm,
                              ),
                              child: SelectableText(
                                _samples[i],
                                style: AppTypography.log.copyWith(color: AppColors.textSecondary),
                              ),
                            ),
                          ),
                        ],
                      );
                    },
                  ),
          ),
        ],
      ),
    );
  }

  Widget _editorPane() {
    return SingleChildScrollView(
      padding: const EdgeInsets.all(AppSpacing.lg),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Row(
            mainAxisAlignment: MainAxisAlignment.spaceBetween,
            children: [
              Row(
                children: [
                  const Icon(Icons.auto_fix_high, size: 12, color: AppColors.textMuted),
                  const SizedBox(width: AppSpacing.xs),
                  Text("EXTRACTION LOGIC", style: AppTypography.labelCaps),
                ],
              ),
            ],
          ),
          const SizedBox(height: AppSpacing.sm),
          TextField(
            controller: _regexController,
            maxLines: 3,
            style: AppTypography.monoBody.copyWith(fontSize: 13, color: AppColors.primary),
            decoration: InputDecoration(
              hintText: r"^(?P<timestamp>.*?) (?P<level>\w+).*",
              errorText: _regexError,
              fillColor: Colors.black.withValues(alpha: 0.6),
            ),
          ),
          const SizedBox(height: AppSpacing.sm),
          Wrap(
            spacing: AppSpacing.xs,
            children: [
              OutlinedButton.icon(
                onPressed: () => _insertSnippet("(?P<timestamp>...)"),
                icon: const Icon(Icons.access_time, size: 14),
                label: const Text("Insert Timestamp Group"),
              ),
              OutlinedButton.icon(
                onPressed: () => _insertSnippet("(?P<level>...)"),
                icon: const Icon(Icons.info_outline, size: 14),
                label: const Text("Insert Level Group"),
              ),
            ],
          ),
          const SizedBox(height: AppSpacing.lg),
          Text("EXTRACTION PREVIEW", style: AppTypography.labelCaps),
          const SizedBox(height: AppSpacing.xs),
          Container(
            decoration: BoxDecoration(
              color: Colors.black.withValues(alpha: 0.4),
              borderRadius: BorderRadius.circular(AppRadius.md),
              border: Border.all(color: AppColors.borderSubtle),
            ),
            child: _preview.isEmpty
                ? const Padding(
                    padding: EdgeInsets.all(AppSpacing.lg),
                    child: Center(
                      child: Text(
                        "Enter regex to see preview",
                        style: TextStyle(color: AppColors.textMuted, fontStyle: FontStyle.italic),
                      ),
                    ),
                  )
                : Column(
                    children: [
                      for (final row in _preview.take(5))
                        Padding(
                          padding: const EdgeInsets.symmetric(
                            horizontal: AppSpacing.sm,
                            vertical: 6,
                          ),
                          child: Row(
                            mainAxisAlignment: MainAxisAlignment.spaceBetween,
                            children: [
                              Expanded(
                                child: Text(
                                  row.timestamp ?? "---",
                                  overflow: TextOverflow.ellipsis,
                                  style: AppTypography.log.copyWith(
                                    fontSize: 11,
                                    color: AppColors.textMuted,
                                  ),
                                ),
                              ),
                              Container(
                                padding: const EdgeInsets.symmetric(horizontal: 6, vertical: 2),
                                decoration: BoxDecoration(
                                  color: row.level == "ERROR"
                                      ? AppColors.error.withValues(alpha: 0.2)
                                      : AppColors.primary.withValues(alpha: 0.2),
                                  borderRadius: BorderRadius.circular(AppRadius.sm),
                                ),
                                child: Text(
                                  (row.level ?? "").toUpperCase(),
                                  style: TextStyle(
                                    fontSize: 9,
                                    fontWeight: FontWeight.w700,
                                    color: row.level == "ERROR" ? AppColors.error : AppColors.primary,
                                  ),
                                ),
                              ),
                            ],
                          ),
                        ),
                    ],
                  ),
          ),
          const SizedBox(height: AppSpacing.lg),
          Container(
            padding: const EdgeInsets.all(AppSpacing.md),
            decoration: BoxDecoration(
              color: AppColors.warningBg.withValues(alpha: 0.3),
              borderRadius: BorderRadius.circular(AppRadius.md),
              border: Border.all(color: AppColors.warning.withValues(alpha: 0.2)),
            ),
            child: Row(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Icon(Icons.info_outline, size: 16, color: AppColors.warning),
                const SizedBox(width: AppSpacing.sm),
                Expanded(
                  child: Text(
                    "Normalized timestamps are critical for Fusion mode.",
                    style: AppTypography.body.copyWith(
                      fontSize: 11,
                      fontStyle: FontStyle.italic,
                      color: AppColors.warning.withValues(alpha: 0.8),
                    ),
                  ),
                ),
              ],
            ),
          ),
          const SizedBox(height: AppSpacing.md),
          Row(
            children: [
              OutlinedButton(
                onPressed: () {
                  _regexController.clear();
                },
                child: const Icon(Icons.delete_outline, size: 18, color: AppColors.error),
              ),
              const SizedBox(width: AppSpacing.sm),
              Expanded(
                child: ElevatedButton(
                  onPressed: _handleSave,
                  child: const Text("Save Definition"),
                ),
              ),
            ],
          ),
        ],
      ),
    );
  }
}
