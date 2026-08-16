import "package:flutter/material.dart";
import "package:flutter_riverpod/flutter_riverpod.dart";
import "package:flutter_test/flutter_test.dart";

import "package:loglensai/providers/workspace_provider.dart";
import "package:loglensai/services/sidecar_bridge.dart";
import "package:loglensai/theme/app_theme.dart";
import "package:loglensai/widgets/organisms/custom_parser_modal.dart";

/// Fake [WorkspaceNotifier] returning fixed sample lines instantly, so
/// tests don't hit a real sidecar over the network.
class _FakeWorkspaceNotifier extends WorkspaceNotifier {
  _FakeWorkspaceNotifier(this._samples) : super(SidecarBridge());

  final List<String> _samples;

  @override
  Future<List<String>> getSampleLines(
    String workspaceId,
    String sourceId, {
    int limit = 15,
  }) async => _samples;
}

ProviderContainer _buildContainer(List<String> samples) {
  return ProviderContainer(
    overrides: [
      workspaceProvider.overrideWith((ref) => _FakeWorkspaceNotifier(samples)),
    ],
  );
}

Widget _wrap(ProviderContainer container, Widget child) {
  return UncontrolledProviderScope(
    container: container,
    child: MaterialApp(theme: AppTheme.dark, home: Scaffold(body: child)),
  );
}

void main() {
  const samples = [
    "2024-01-01 10:00:00 ERROR something broke",
    "2024-01-01 10:00:05 INFO all good",
  ];

  // The modal's editor pane (`minHeight: 520` plus header/margins) overflows
  // the default 800x600 test surface, pushing "Save Definition" below the
  // visible/hit-testable area. Widen the surface for every test in this file.
  setUp(() {
    final binding = TestWidgetsFlutterBinding.ensureInitialized();
    binding.platformDispatcher.views.first.physicalSize = const Size(1400, 1100);
    binding.platformDispatcher.views.first.devicePixelRatio = 1.0;
  });
  tearDown(() {
    final binding = TestWidgetsFlutterBinding.ensureInitialized();
    binding.platformDispatcher.views.first.resetPhysicalSize();
    binding.platformDispatcher.views.first.resetDevicePixelRatio();
  });

  testWidgets("renders nothing when isOpen is false", (tester) async {
    final container = _buildContainer(samples);
    addTearDown(container.dispose);

    await tester.pumpWidget(
      _wrap(
        container,
        CustomParserModal(
          workspaceId: "ws1",
          sourceId: "src1",
          isOpen: false,
          onClose: () {},
          onSaved: (_) {},
        ),
      ),
    );

    expect(find.text("Parser Architect"), findsNothing);
  });

  testWidgets("loads and renders raw samples when open", (tester) async {
    final container = _buildContainer(samples);
    addTearDown(container.dispose);

    await tester.pumpWidget(
      _wrap(
        container,
        CustomParserModal(
          workspaceId: "ws1",
          sourceId: "src1",
          isOpen: true,
          onClose: () {},
          onSaved: (_) {},
        ),
      ),
    );
    await tester.pump();

    expect(find.text("Parser Architect"), findsOneWidget);
    expect(find.text(samples[0]), findsOneWidget);
    expect(find.text(samples[1]), findsOneWidget);
    expect(find.text("Enter regex to see preview"), findsOneWidget);
  });

  testWidgets("entering a valid named-group regex populates the live preview", (tester) async {
    final container = _buildContainer(samples);
    addTearDown(container.dispose);

    await tester.pumpWidget(
      _wrap(
        container,
        CustomParserModal(
          workspaceId: "ws1",
          sourceId: "src1",
          isOpen: true,
          onClose: () {},
          onSaved: (_) {},
        ),
      ),
    );
    await tester.pump();

    await tester.enterText(
      find.byType(TextField).first,
      r"^(?P<timestamp>\S+ \S+) (?P<level>\w+).*",
    );
    await tester.pump();

    expect(find.text("2024-01-01 10:00:00"), findsOneWidget);
    expect(find.text("ERROR"), findsOneWidget);
    expect(find.text("2024-01-01 10:00:05"), findsOneWidget);
    expect(find.text("INFO"), findsOneWidget);
  });

  testWidgets("a non-matching regex shows 'No match' rows without throwing", (tester) async {
    final container = _buildContainer(samples);
    addTearDown(container.dispose);

    await tester.pumpWidget(
      _wrap(
        container,
        CustomParserModal(
          workspaceId: "ws1",
          sourceId: "src1",
          isOpen: true,
          onClose: () {},
          onSaved: (_) {},
        ),
      ),
    );
    await tester.pump();

    await tester.enterText(find.byType(TextField).first, r"^ZZZ_NEVER_MATCHES_ZZZ$");
    await tester.pump();

    expect(find.text("No match"), findsWidgets);
  });

  testWidgets("Insert Timestamp Group splices the named-group snippet into the regex field", (
    tester,
  ) async {
    final container = _buildContainer(samples);
    addTearDown(container.dispose);

    await tester.pumpWidget(
      _wrap(
        container,
        CustomParserModal(
          workspaceId: "ws1",
          sourceId: "src1",
          isOpen: true,
          onClose: () {},
          onSaved: (_) {},
        ),
      ),
    );
    await tester.pump();

    await tester.tap(find.widgetWithText(OutlinedButton, "Insert Timestamp Group"));
    await tester.pump();

    final field = tester.widget<TextField>(find.byType(TextField).first);
    expect(field.controller!.text, "(?P<timestamp>...)");
  });

  testWidgets("Save Definition emits the regex as JSON and closes", (tester) async {
    final container = _buildContainer(samples);
    addTearDown(container.dispose);

    String? saved;
    var closed = false;
    await tester.pumpWidget(
      _wrap(
        container,
        CustomParserModal(
          workspaceId: "ws1",
          sourceId: "src1",
          isOpen: true,
          onClose: () => closed = true,
          onSaved: (json) => saved = json,
        ),
      ),
    );
    await tester.pump();

    await tester.enterText(find.byType(TextField).first, r"^(?P<level>\w+).*");
    await tester.pump();

    await tester.tap(find.text("Save Definition"));
    await tester.pump();

    expect(saved, '{"regex":"^(?P<level>\\\\w+).*","mapping":{}}');
    expect(closed, isTrue);
  });

  testWidgets("prefills the regex field from initialConfig", (tester) async {
    final container = _buildContainer(samples);
    addTearDown(container.dispose);

    await tester.pumpWidget(
      _wrap(
        container,
        CustomParserModal(
          workspaceId: "ws1",
          sourceId: "src1",
          isOpen: true,
          onClose: () {},
          onSaved: (_) {},
          initialConfig: r'{"regex":"^(?P<level>\\w+).*","mapping":{}}',
        ),
      ),
    );
    await tester.pump();

    final field = tester.widget<TextField>(find.byType(TextField).first);
    expect(field.controller!.text, r"^(?P<level>\w+).*");
  });
}
