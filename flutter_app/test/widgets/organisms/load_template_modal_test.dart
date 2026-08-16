import "package:flutter/material.dart";
import "package:flutter_riverpod/flutter_riverpod.dart";
import "package:flutter_test/flutter_test.dart";

import "package:loglensai/models/log_entry.dart";
import "package:loglensai/models/template.dart";
import "package:loglensai/providers/template_provider.dart";
import "package:loglensai/services/sidecar_bridge.dart";
import "package:loglensai/theme/app_theme.dart";
import "package:loglensai/widgets/molecules/highlight_builder.dart";
import "package:loglensai/widgets/organisms/load_template_modal.dart";
import "package:loglensai/widgets/organisms/template_codec.dart";

/// Fake [TemplateService] -- same rationale as `_FakeAiNotifier` in
/// `ai_investigation_sidebar_test.dart`: overrides every RPC-backed method
/// with an in-memory stand-in so tests never touch a real [SidecarBridge].
class _FakeTemplateService extends TemplateService {
  _FakeTemplateService({
    this.templates = const [],
    this.throwOnFetch = false,
    this.throwOnDelete = false,
  }) : super(SidecarBridge());

  final List<Template> templates;
  final bool throwOnFetch;
  final bool throwOnDelete;
  final List<int> deleteCalls = [];

  @override
  Future<List<Template>> fetchTemplates(String workspaceId) async {
    if (throwOnFetch) throw Exception("boom");
    return templates;
  }

  @override
  Future<void> deleteTemplate(int id) async {
    if (throwOnDelete) throw Exception("boom");
    deleteCalls.add(id);
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
        LoadTemplateModal(isOpen: false, onClose: () {}, workspaceId: "ws1", onLoad: (_, _) {}),
      ),
    );
    await tester.pump();

    expect(find.text("Load Template"), findsNothing);
  });

  testWidgets("shows the empty state when there are no saved templates", (tester) async {
    final container = _buildContainer(_FakeTemplateService());
    addTearDown(container.dispose);

    await tester.pumpWidget(
      _wrap(
        container,
        LoadTemplateModal(isOpen: true, onClose: () {}, workspaceId: "ws1", onLoad: (_, _) {}),
      ),
    );
    await tester.pumpAndSettle();

    expect(find.text("No templates saved yet"), findsOneWidget);
  });

  testWidgets("shows an error toast when fetching templates fails", (tester) async {
    final container = _buildContainer(_FakeTemplateService(throwOnFetch: true));
    addTearDown(container.dispose);

    await tester.pumpWidget(
      _wrap(
        container,
        LoadTemplateModal(isOpen: true, onClose: () {}, workspaceId: "ws1", onLoad: (_, _) {}),
      ),
    );
    await tester.pumpAndSettle();

    expect(find.text("Could not load templates"), findsOneWidget);
    // The template list stays empty on fetch failure (mirrors the React
    // source: the catch block only toasts, it never populates `templates`),
    // so the same empty-state placeholder used for "no saved templates" is
    // shown underneath the error toast.
    expect(find.text("No templates saved yet"), findsOneWidget);
  });

  testWidgets("lists fetched templates by name", (tester) async {
    final service = _FakeTemplateService(
      templates: const [
        Template(id: 1, name: "Prod Errors", config: "{}", createdAt: "2026-08-01T00:00:00Z"),
        Template(id: 2, name: "Auth Debug", config: "{}", createdAt: "2026-08-02T00:00:00Z"),
      ],
    );
    final container = _buildContainer(service);
    addTearDown(container.dispose);

    await tester.pumpWidget(
      _wrap(
        container,
        LoadTemplateModal(isOpen: true, onClose: () {}, workspaceId: "ws1", onLoad: (_, _) {}),
      ),
    );
    await tester.pumpAndSettle();

    expect(find.text("Prod Errors"), findsOneWidget);
    expect(find.text("Auth Debug"), findsOneWidget);
  });

  testWidgets("tapping a template calls onLoad with the decoded config and closes", (tester) async {
    final config = const TemplateConfig(
      filters: [LogFilter(field: "level", value: "ERROR", operator: "equals")],
      highlights: [HighlightRule(term: "timeout", color: Color(0xFFFBBF24))],
    ).encode();
    final service = _FakeTemplateService(
      templates: [Template(id: 1, name: "Prod Errors", config: config, createdAt: "2026-08-01T00:00:00Z")],
    );
    final container = _buildContainer(service);
    addTearDown(container.dispose);

    List<LogFilter>? loadedFilters;
    List<HighlightRule>? loadedHighlights;
    var closed = false;

    await tester.pumpWidget(
      _wrap(
        container,
        LoadTemplateModal(
          isOpen: true,
          onClose: () => closed = true,
          workspaceId: "ws1",
          onLoad: (f, h) {
            loadedFilters = f;
            loadedHighlights = h;
          },
        ),
      ),
    );
    await tester.pumpAndSettle();

    await tester.tap(find.text("Prod Errors"));
    await tester.pump();

    expect(loadedFilters, hasLength(1));
    expect(loadedFilters!.single.field, "level");
    expect(loadedFilters!.single.value, "ERROR");
    expect(loadedHighlights, hasLength(1));
    expect(loadedHighlights!.single.term, "timeout");
    expect(closed, isTrue);
  });

  testWidgets("shows an error and doesn't call onLoad for a corrupted template", (tester) async {
    final service = _FakeTemplateService(
      templates: const [Template(id: 1, name: "Broken", config: "not json", createdAt: "2026-08-01T00:00:00Z")],
    );
    final container = _buildContainer(service);
    addTearDown(container.dispose);
    var loadCalled = false;

    await tester.pumpWidget(
      _wrap(
        container,
        LoadTemplateModal(
          isOpen: true,
          onClose: () {},
          workspaceId: "ws1",
          onLoad: (_, _) => loadCalled = true,
        ),
      ),
    );
    await tester.pumpAndSettle();

    await tester.tap(find.text("Broken"));
    await tester.pump();

    expect(loadCalled, isFalse);
    expect(find.text("Template data is corrupted"), findsOneWidget);
  });

  testWidgets("delete button removes the template locally and calls deleteTemplate", (tester) async {
    final service = _FakeTemplateService(
      templates: const [Template(id: 1, name: "T1", config: "{}", createdAt: "2026-08-01T00:00:00Z")],
    );
    final container = _buildContainer(service);
    addTearDown(container.dispose);

    await tester.pumpWidget(
      _wrap(
        container,
        LoadTemplateModal(isOpen: true, onClose: () {}, workspaceId: "ws1", onLoad: (_, _) {}),
      ),
    );
    await tester.pumpAndSettle();

    await tester.tap(find.byTooltip("Delete template"));
    await tester.pump();

    expect(service.deleteCalls, [1]);
    expect(find.text("T1"), findsNothing);
    expect(find.text("Template removed"), findsOneWidget);
  });

  testWidgets("shows an error toast and keeps the template when delete fails", (tester) async {
    final service = _FakeTemplateService(
      templates: const [Template(id: 1, name: "T1", config: "{}", createdAt: "2026-08-01T00:00:00Z")],
      throwOnDelete: true,
    );
    final container = _buildContainer(service);
    addTearDown(container.dispose);

    await tester.pumpWidget(
      _wrap(
        container,
        LoadTemplateModal(isOpen: true, onClose: () {}, workspaceId: "ws1", onLoad: (_, _) {}),
      ),
    );
    await tester.pumpAndSettle();

    await tester.tap(find.byTooltip("Delete template"));
    await tester.pump();

    expect(find.text("T1"), findsOneWidget);
    expect(find.text("Could not delete template"), findsOneWidget);
  });
}
