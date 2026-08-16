import "package:flutter/material.dart";
import "package:flutter_riverpod/flutter_riverpod.dart";
import "package:flutter_test/flutter_test.dart";

import "package:loglensai/models/log_entry.dart";
import "package:loglensai/providers/template_provider.dart";
import "package:loglensai/services/sidecar_bridge.dart";
import "package:loglensai/theme/app_theme.dart";
import "package:loglensai/widgets/molecules/highlight_builder.dart";
import "package:loglensai/widgets/organisms/save_template_modal.dart";
import "package:loglensai/widgets/organisms/template_codec.dart";

/// Fake [TemplateService], same pattern as `load_template_modal_test.dart`.
class _FakeTemplateService extends TemplateService {
  _FakeTemplateService({this.throwOnSave = false}) : super(SidecarBridge());

  final bool throwOnSave;
  final List<Map<String, String>> saveCalls = [];

  @override
  Future<void> saveTemplate({
    required String workspaceId,
    required String name,
    required String configJson,
  }) async {
    if (throwOnSave) throw Exception("boom");
    saveCalls.add({"workspaceId": workspaceId, "name": name, "configJson": configJson});
  }
}

ProviderContainer _buildContainer(_FakeTemplateService service) {
  return ProviderContainer(overrides: [templateServiceProvider.overrideWithValue(service)]);
}

Widget _wrap(ProviderContainer container, Widget child) {
  return UncontrolledProviderScope(
    container: container,
    child: MaterialApp(theme: AppTheme.dark, home: Scaffold(body: child)),
  );
}

void main() {
  testWidgets("renders nothing when isOpen is false", (tester) async {
    final container = _buildContainer(_FakeTemplateService());
    addTearDown(container.dispose);

    await tester.pumpWidget(
      _wrap(
        container,
        SaveTemplateModal(
          isOpen: false,
          onClose: () {},
          workspaceId: "ws1",
          filters: const [],
          highlights: const [],
        ),
      ),
    );
    await tester.pump();

    expect(find.text("Save Template"), findsNothing);
  });

  testWidgets("shows the filter/highlight counts and disables Save Template until a name is entered", (
    tester,
  ) async {
    final container = _buildContainer(_FakeTemplateService());
    addTearDown(container.dispose);

    await tester.pumpWidget(
      _wrap(
        container,
        SaveTemplateModal(
          isOpen: true,
          onClose: () {},
          workspaceId: "ws1",
          filters: const [LogFilter(field: "level", value: "ERROR")],
          highlights: const [HighlightRule(term: "timeout", color: Color(0xFFFBBF24))],
        ),
      ),
    );
    await tester.pump();

    expect(find.text("1 Filters"), findsOneWidget);
    expect(find.text("1 Highlights"), findsOneWidget);

    final saveFinder = find.widgetWithText(ElevatedButton, "Save Template");
    expect(tester.widget<ElevatedButton>(saveFinder).onPressed, isNull);

    await tester.enterText(find.byType(TextField), "My Template");
    await tester.pump();

    expect(tester.widget<ElevatedButton>(saveFinder).onPressed, isNotNull);
  });

  testWidgets("saving persists the encoded filters/highlights and closes", (tester) async {
    final service = _FakeTemplateService();
    final container = _buildContainer(service);
    addTearDown(container.dispose);
    var closed = false;

    await tester.pumpWidget(
      _wrap(
        container,
        SaveTemplateModal(
          isOpen: true,
          onClose: () => closed = true,
          workspaceId: "ws1",
          filters: const [LogFilter(field: "level", value: "ERROR", operator: "equals")],
          highlights: const [],
        ),
      ),
    );
    await tester.pump();

    await tester.enterText(find.byType(TextField), "Prod Errors");
    await tester.pump();
    await tester.tap(find.widgetWithText(ElevatedButton, "Save Template"));
    await tester.pumpAndSettle();

    expect(service.saveCalls, hasLength(1));
    expect(service.saveCalls.single["workspaceId"], "ws1");
    expect(service.saveCalls.single["name"], "Prod Errors");

    final decoded = TemplateConfig.decode(service.saveCalls.single["configJson"]!);
    expect(decoded.filters, hasLength(1));
    expect(decoded.filters.single.field, "level");
    expect(closed, isTrue);
  });

  testWidgets("save failure keeps the modal open and shows an error", (tester) async {
    final service = _FakeTemplateService(throwOnSave: true);
    final container = _buildContainer(service);
    addTearDown(container.dispose);
    var closed = false;

    await tester.pumpWidget(
      _wrap(
        container,
        SaveTemplateModal(
          isOpen: true,
          onClose: () => closed = true,
          workspaceId: "ws1",
          filters: const [],
          highlights: const [],
        ),
      ),
    );
    await tester.pump();

    await tester.enterText(find.byType(TextField), "Prod Errors");
    await tester.pump();
    await tester.tap(find.widgetWithText(ElevatedButton, "Save Template"));
    await tester.pumpAndSettle();

    expect(closed, isFalse);
    expect(find.text("Could not save template"), findsOneWidget);
  });

  testWidgets("Cancel closes without saving", (tester) async {
    final service = _FakeTemplateService();
    final container = _buildContainer(service);
    addTearDown(container.dispose);
    var closed = false;

    await tester.pumpWidget(
      _wrap(
        container,
        SaveTemplateModal(
          isOpen: true,
          onClose: () => closed = true,
          workspaceId: "ws1",
          filters: const [],
          highlights: const [],
        ),
      ),
    );
    await tester.pump();

    await tester.tap(find.text("Cancel"));
    await tester.pump();

    expect(closed, isTrue);
    expect(service.saveCalls, isEmpty);
  });
}
