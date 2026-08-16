import "package:flutter/material.dart";

import "../../theme/app_theme.dart";

/// Lightweight, dependency-free markdown renderer for AI chat messages.
///
/// Port of `src/components/atoms/MarkdownContent.tsx`. Supports the exact
/// same minimal subset the React version hand-rolls -- **bold** text,
/// `inline code`, ```code blocks```, `-`/`*` bullet lists, `1.`/`1)`
/// numbered lists, and line breaks -- nothing more (no headings, links,
/// tables, blockquotes, etc.).
///
/// Deviation: Flutter's [TextSpan] renders an embedded `\n` as a real line
/// break natively, so unlike the React source (which must synthesize
/// `<br/>` elements via a dedicated `renderLineBreaks` pass), this port
/// just keeps `\n` in the text and lets the framework handle it.
class MarkdownContent extends StatelessWidget {
  const MarkdownContent({super.key, required this.content});

  /// Raw text content to render with lightweight markdown support.
  final String content;

  @override
  Widget build(BuildContext context) {
    final blocks = _parseBlocks(content);
    return Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      mainAxisSize: MainAxisSize.min,
      children: [
        for (var i = 0; i < blocks.length; i++) ...[
          if (i > 0) const SizedBox(height: AppSpacing.sm),
          blocks[i],
        ],
      ],
    );
  }
}

final RegExp _bulletRe = RegExp(r"^\s*[-*]\s+");
final RegExp _orderedRe = RegExp(r"^\s*\d+[.)]\s+");
final RegExp _inlineRe = RegExp(r"(\*\*[^*]+\*\*|`[^`]+`)");

/// Splits [text] into block-level widgets. Mirrors `parseMarkdown` in the
/// React source.
List<Widget> _parseBlocks(String text) {
  final blocks = <Widget>[];
  final lines = text.split("\n");
  var i = 0;

  while (i < lines.length) {
    final line = lines[i];

    if (line.trimLeft().startsWith("```")) {
      final result = _parseCodeBlock(lines, i);
      blocks.add(result.$1);
      i = result.$2;
      continue;
    }

    if (_bulletRe.hasMatch(line)) {
      final result = _parseBulletList(lines, i);
      blocks.add(result.$1);
      i = result.$2;
      continue;
    }

    if (_orderedRe.hasMatch(line)) {
      final result = _parseOrderedList(lines, i);
      blocks.add(result.$1);
      i = result.$2;
      continue;
    }

    if (line.trim().isEmpty) {
      i++;
      continue;
    }

    final result = _parseParagraph(lines, i);
    blocks.add(result.$1);
    i = result.$2;
  }

  return blocks;
}

(Widget, int) _parseCodeBlock(List<String> lines, int start) {
  final codeLines = <String>[];
  var i = start + 1;
  while (i < lines.length && !lines[i].trimLeft().startsWith("```")) {
    codeLines.add(lines[i]);
    i++;
  }
  final widget = Container(
    width: double.infinity,
    padding: const EdgeInsets.symmetric(horizontal: AppSpacing.sm, vertical: 10),
    decoration: BoxDecoration(
      color: AppColors.bgBase.withValues(alpha: 0.8),
      border: Border.all(color: AppColors.border.withValues(alpha: 0.6)),
      borderRadius: BorderRadius.circular(AppRadius.md),
    ),
    child: SingleChildScrollView(
      scrollDirection: Axis.horizontal,
      child: Text(
        codeLines.join("\n"),
        style: AppTypography.log.copyWith(color: AppColors.primary.withValues(alpha: 0.9)),
      ),
    ),
  );
  // Skip the closing ``` fence.
  return (widget, i + 1);
}

(Widget, int) _parseBulletList(List<String> lines, int start) {
  final items = <String>[];
  var i = start;
  while (i < lines.length && _bulletRe.hasMatch(lines[i])) {
    items.add(lines[i].replaceFirst(_bulletRe, ""));
    i++;
  }
  final widget = Padding(
    padding: const EdgeInsets.only(left: AppSpacing.sm),
    child: Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      mainAxisSize: MainAxisSize.min,
      children: [
        for (final item in items)
          Padding(
            padding: const EdgeInsets.only(bottom: 4),
            child: Row(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Padding(
                  padding: const EdgeInsets.only(top: 4, right: AppSpacing.xs),
                  child: Text(
                    "•",
                    style: TextStyle(color: AppColors.primary.withValues(alpha: 0.4), fontSize: 12),
                  ),
                ),
                Expanded(
                  child: Text.rich(
                    TextSpan(children: _renderInline(item)),
                    style: AppTypography.body.copyWith(fontSize: 13, height: 1.5),
                  ),
                ),
              ],
            ),
          ),
      ],
    ),
  );
  return (widget, i);
}

(Widget, int) _parseOrderedList(List<String> lines, int start) {
  final items = <String>[];
  var i = start;
  while (i < lines.length && _orderedRe.hasMatch(lines[i])) {
    items.add(lines[i].replaceFirst(_orderedRe, ""));
    i++;
  }
  final widget = Padding(
    padding: const EdgeInsets.only(left: AppSpacing.sm),
    child: Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      mainAxisSize: MainAxisSize.min,
      children: [
        for (var li = 0; li < items.length; li++)
          Padding(
            padding: const EdgeInsets.only(bottom: 4),
            child: Row(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Padding(
                  padding: const EdgeInsets.only(right: AppSpacing.xs),
                  child: Text(
                    "${li + 1}.",
                    style: AppTypography.body.copyWith(
                      fontSize: 13,
                      color: AppColors.textMuted,
                      height: 1.5,
                    ),
                  ),
                ),
                Expanded(
                  child: Text.rich(
                    TextSpan(children: _renderInline(items[li])),
                    style: AppTypography.body.copyWith(fontSize: 13, height: 1.5),
                  ),
                ),
              ],
            ),
          ),
      ],
    ),
  );
  return (widget, i);
}

(Widget, int) _parseParagraph(List<String> lines, int start) {
  final paraLines = <String>[];
  var i = start;
  while (i < lines.length &&
      lines[i].trim().isNotEmpty &&
      !lines[i].trimLeft().startsWith("```") &&
      !_bulletRe.hasMatch(lines[i]) &&
      !_orderedRe.hasMatch(lines[i])) {
    paraLines.add(lines[i]);
    i++;
  }
  final widget = Text.rich(
    TextSpan(children: _renderInline(paraLines.join("\n"))),
    style: AppTypography.body.copyWith(fontSize: 13, height: 1.5),
  );
  return (widget, i);
}

/// Renders inline markdown within a paragraph/list-item: `**bold**` and
/// `` `code` ``. Mirrors `renderInline` in the React source (minus the
/// separate line-break pass -- see the class doc comment).
List<InlineSpan> _renderInline(String text) {
  final spans = <InlineSpan>[];
  var lastIndex = 0;

  for (final match in _inlineRe.allMatches(text)) {
    if (match.start > lastIndex) {
      spans.add(TextSpan(text: text.substring(lastIndex, match.start)));
    }

    final token = match.group(0)!;
    if (token.startsWith("**")) {
      spans.add(
        TextSpan(
          text: token.substring(2, token.length - 2),
          style: const TextStyle(fontWeight: FontWeight.w700, color: AppColors.textPrimary),
        ),
      );
    } else {
      spans.add(
        TextSpan(
          text: token.substring(1, token.length - 1),
          style: TextStyle(
            fontFamily: AppTypography.monoFamily,
            fontFamilyFallback: const ["Cascadia Mono", "Consolas", "Courier New", "monospace"],
            fontSize: 11,
            color: AppColors.primary.withValues(alpha: 0.9),
          ),
        ),
      );
    }

    lastIndex = match.end;
  }

  if (lastIndex < text.length) {
    spans.add(TextSpan(text: text.substring(lastIndex)));
  }

  return spans;
}
