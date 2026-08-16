import "package:flutter/material.dart";
import "package:flutter_test/flutter_test.dart";

import "package:loglensai/theme/app_theme.dart";
import "package:loglensai/widgets/atoms/markdown_content.dart";

Widget _wrap(Widget child) {
  return MaterialApp(theme: AppTheme.dark, home: Scaffold(body: child));
}

/// Flutter's [Text.rich] wraps the [InlineSpan] you pass it as a single
/// nested child of the [RichText] it builds, rather than splicing its
/// children in directly -- so asserting on a specific leaf span requires
/// walking the whole tree, not just `root.children`.
List<TextSpan> _flattenTextSpans(InlineSpan span) {
  final result = <TextSpan>[];
  if (span is TextSpan) {
    result.add(span);
    for (final child in span.children ?? const <InlineSpan>[]) {
      result.addAll(_flattenTextSpans(child));
    }
  }
  return result;
}

void main() {
  testWidgets("renders a plain paragraph", (tester) async {
    await tester.pumpWidget(_wrap(const MarkdownContent(content: "Plain text")));

    expect(find.text("Plain text"), findsOneWidget);
  });

  testWidgets("renders **bold** as a bold TextSpan", (tester) async {
    await tester.pumpWidget(_wrap(const MarkdownContent(content: "before **bold** after")));

    final richText = tester.widget<RichText>(find.byType(RichText).first);
    final boldSpan = _flattenTextSpans(richText.text).firstWhere((s) => s.text == "bold");
    expect(boldSpan.style!.fontWeight, FontWeight.w700);
  });

  testWidgets("renders `inline code` with a monospace style", (tester) async {
    await tester.pumpWidget(_wrap(const MarkdownContent(content: "run `flutter test` now")));

    final richText = tester.widget<RichText>(find.byType(RichText).first);
    final codeSpan = _flattenTextSpans(
      richText.text,
    ).firstWhere((s) => s.text == "flutter test");
    expect(codeSpan.style!.fontFamily, AppTypography.monoFamily);
  });

  testWidgets("renders a fenced code block verbatim", (tester) async {
    await tester.pumpWidget(
      _wrap(const MarkdownContent(content: "```\nconst x = 1;\n```")),
    );

    expect(find.text("const x = 1;"), findsOneWidget);
  });

  testWidgets("renders a bullet list, one bullet per item", (tester) async {
    await tester.pumpWidget(
      _wrap(const MarkdownContent(content: "- one\n- two\n- three")),
    );

    expect(find.text("•"), findsNWidgets(3));
    expect(find.text("one"), findsOneWidget);
    expect(find.text("two"), findsOneWidget);
    expect(find.text("three"), findsOneWidget);
  });

  testWidgets("renders a numbered list with sequential markers", (tester) async {
    await tester.pumpWidget(
      _wrap(const MarkdownContent(content: "1. first\n2. second")),
    );

    expect(find.text("1."), findsOneWidget);
    expect(find.text("2."), findsOneWidget);
  });

  testWidgets("blank lines separate paragraphs into distinct blocks", (tester) async {
    await tester.pumpWidget(
      _wrap(const MarkdownContent(content: "para one\n\npara two")),
    );

    expect(find.text("para one"), findsOneWidget);
    expect(find.text("para two"), findsOneWidget);
  });
}
