/// Dart port of `src/components/molecules/NativeFilePicker.tsx`.
///
/// The React version branches on Tauri-vs-web to pick a native dialog or an
/// `<input type=file>` fallback. Flutter has no such split: [file_picker]
/// (https://pub.dev/packages/file_picker) is used unconditionally to open
/// the OS-native file picker on every desktop target.
library;

import "package:file_picker/file_picker.dart";
import "package:flutter/material.dart";

import "../../theme/app_colors.dart";
import "../../theme/app_spacing.dart";
import "../../theme/app_typography.dart";

/// Mirrors the TS `FileFilter { name, extensions }` shape. An `extensions`
/// list containing `"*"` means "no extension restriction" (mapped to
/// [FileType.any] rather than passed through to `file_picker`, which -
/// unlike the browser `accept` attribute - rejects literal `"*"` entries).
class FileFilterGroup {
  const FileFilterGroup({required this.name, required this.extensions});

  final String name;
  final List<String> extensions;
}

const List<FileFilterGroup> _defaultFilters = [
  FileFilterGroup(name: "Common Logs", extensions: ["log", "syslog", "txt", "json", "csv"]),
  FileFilterGroup(name: "All Files", extensions: ["*"]),
];

class NativeFilePicker extends StatelessWidget {
  const NativeFilePicker({
    super.key,
    required this.value,
    required this.onChange,
    this.placeholder = "Select a file...",
    this.filters = _defaultFilters,
    this.disabled = false,
  });

  final String value;
  final ValueChanged<String> onChange;
  final String placeholder;
  final List<FileFilterGroup> filters;
  final bool disabled;

  Future<void> _handleBrowse(BuildContext context) async {
    final extensions = filters
        .expand((f) => f.extensions)
        .where((ext) => ext != "*")
        .toList();
    final hasWildcard = filters.any((f) => f.extensions.contains("*"));

    try {
      final result = await FilePicker.platform.pickFiles(
        dialogTitle: "Select File",
        type: (hasWildcard || extensions.isEmpty) ? FileType.any : FileType.custom,
        allowedExtensions: (hasWildcard || extensions.isEmpty) ? null : extensions,
        allowMultiple: false,
      );
      final path = result?.files.single.path;
      if (path != null) {
        onChange(path);
      }
    } catch (e) {
      if (context.mounted) {
        ScaffoldMessenger.of(context).showSnackBar(
          const SnackBar(content: Text("Could not open file picker.")),
        );
      }
    }
  }

  @override
  Widget build(BuildContext context) {
    return Row(
      children: [
        Expanded(
          child: TextField(
            enabled: !disabled,
            controller: TextEditingController(text: value)
              ..selection = TextSelection.collapsed(offset: value.length),
            onChanged: onChange,
            style: AppTypography.log.copyWith(fontSize: 12),
            decoration: InputDecoration(
              isDense: true,
              hintText: placeholder,
              hintStyle: AppTypography.log.copyWith(fontSize: 12, color: AppColors.textMuted),
              filled: true,
              fillColor: AppColors.bgSurfaceBright,
              contentPadding: const EdgeInsets.symmetric(
                horizontal: AppSpacing.sm,
                vertical: AppSpacing.sm,
              ),
              border: OutlineInputBorder(
                borderRadius: BorderRadius.circular(6),
                borderSide: BorderSide(color: AppColors.border),
              ),
            ),
          ),
        ),
        const SizedBox(width: AppSpacing.sm),
        OutlinedButton.icon(
          onPressed: disabled ? null : () => _handleBrowse(context),
          icon: const Icon(Icons.folder_open, size: 16),
          label: const Text("Browse"),
          style: OutlinedButton.styleFrom(
            foregroundColor: AppColors.textPrimary,
            side: BorderSide(color: AppColors.border),
            textStyle: AppTypography.body.copyWith(fontWeight: FontWeight.w700, fontSize: 13),
          ),
        ),
      ],
    );
  }
}
