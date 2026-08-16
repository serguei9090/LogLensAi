import "package:flutter/material.dart";
import "package:flutter_test/flutter_test.dart";
import "package:loglensai/theme/app_theme.dart";
import "package:loglensai/widgets/molecules/source_selector.dart";

const _options = [
  SourceSelectorOption(id: "local", icon: Icons.insert_drive_file_outlined, label: "Local File"),
  SourceSelectorOption(id: "ssh", icon: Icons.terminal, label: "SSH"),
  SourceSelectorOption(id: "paste", icon: Icons.content_paste, label: "Paste"),
];

Widget _host(Widget child) => MaterialApp(theme: AppTheme.dark, home: Scaffold(body: child));

void main() {
  testWidgets("renders every option's label", (tester) async {
    await tester.pumpWidget(
      _host(SourceSelector(options: _options, activeId: "local", onSelect: (_) {})),
    );

    expect(find.text("Local File"), findsOneWidget);
    expect(find.text("SSH"), findsOneWidget);
    expect(find.text("Paste"), findsOneWidget);
  });

  testWidgets("tapping an option fires onSelect with its id", (tester) async {
    String? selected;
    await tester.pumpWidget(
      _host(SourceSelector(options: _options, activeId: "local", onSelect: (id) => selected = id)),
    );

    await tester.tap(find.text("SSH"));
    await tester.pump();

    expect(selected, "ssh");
  });
}
