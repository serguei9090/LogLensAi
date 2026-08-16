import "package:flutter/material.dart";
import "package:flutter_riverpod/flutter_riverpod.dart";
import "package:flutter_test/flutter_test.dart";

import "package:loglensai/models/fusion_config.dart";
import "package:loglensai/models/workspace.dart";
import "package:loglensai/providers/fusion_provider.dart";
import "package:loglensai/services/sidecar_bridge.dart";
import "package:loglensai/theme/app_theme.dart";
import "package:loglensai/widgets/organisms/fusion_config_engine.dart";

/// Fake [FusionConfigService] that never touches a real [SidecarBridge] --
/// overrides fetch/save with in-memory stand-ins, mirroring the
/// `_FakeAiNotifier` pattern used by `ai_investigation_sidebar_test.dart`.
class _FakeFusionConfigService extends FusionConfigService {
  _FakeFusionConfigService({
    this.existing = const [],
    this.throwOnFetch = false,
    this.throwOnSave = false,
  }) : super(SidecarBridge());

  final List<FusionSourceConfig> existing;
  final bool throwOnFetch;
  final bool throwOnSave;
  final List<List<FusionSourceConfig>> saveCalls = [];

  @override
  Future<List<FusionSourceConfig>> fetchConfig(String workspaceId) async {
    if (throwOnFetch) throw Exception("boom");
    return existing;
  }

  @override
  Future<void> saveConfig(String workspaceId, List<FusionSourceConfig> configs) async {
    if (throwOnSave) throw Exception("boom");
    saveCalls.add(configs);
  }
}

ProviderContainer _buildContainer(_FakeFusionConfigService service) {
  return ProviderContainer(overrides: [fusionConfigServiceProvider.overrideWithValue(service)]);
}

Widget _wrap(ProviderContainer container, Widget child) {
  return UncontrolledProviderScope(
    container: container,
    child: MaterialApp(theme: AppTheme.dark, home: Scaffold(body: child)),
  );
}

void main() {
  // The built-in parser fallback `AlertDialog` (a 360px-wide, 5-line text
  // field plus actions) can push its Save button below the default 800x600
  // test surface once centered under the page's own content. Widen the
  // surface for every test (same rationale as `custom_parser_modal_test.dart`).
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

  const sources = [LogSource(id: "s1", name: "App A", type: "local", path: "/var/log/a.log")];

  testWidgets("shows a loading state then the merged per-source config", (tester) async {
    final service = _FakeFusionConfigService();
    final container = _buildContainer(service);
    addTearDown(container.dispose);

    await tester.pumpWidget(
      _wrap(
        container,
        FusionConfigEngine(workspaceId: "ws1", availableSources: sources, onConfigSaved: () {}),
      ),
    );
    expect(find.text("INITIALIZING FUSION ENGINE..."), findsOneWidget);

    await tester.pumpAndSettle();

    expect(find.text("App A"), findsOneWidget);
    expect(find.text("/var/log/a.log"), findsOneWidget);
    expect(find.text("UTC +00:00"), findsOneWidget);
  });

  testWidgets("merges with an already-saved config for a known source", (tester) async {
    final service = _FakeFusionConfigService(
      existing: const [FusionSourceConfig(sourceId: "/var/log/a.log", enabled: false, tzOffset: 5)],
    );
    final container = _buildContainer(service);
    addTearDown(container.dispose);

    await tester.pumpWidget(
      _wrap(
        container,
        FusionConfigEngine(workspaceId: "ws1", availableSources: sources, onConfigSaved: () {}),
      ),
    );
    await tester.pumpAndSettle();

    // The saved config's tz_offset=+5 and enabled=false should win over the
    // "enabled:true, tzOffset:0" defaults used for a source with no saved row.
    expect(find.text("UTC +05:00"), findsOneWidget);
    expect(find.byIcon(Icons.check), findsNothing);
  });

  testWidgets("shows a fetch-failure toast and stops loading", (tester) async {
    final service = _FakeFusionConfigService(throwOnFetch: true);
    final container = _buildContainer(service);
    addTearDown(container.dispose);

    await tester.pumpWidget(
      _wrap(
        container,
        FusionConfigEngine(workspaceId: "ws1", availableSources: sources, onConfigSaved: () {}),
      ),
    );
    await tester.pumpAndSettle();

    expect(find.text("Could not sync orchestration settings."), findsOneWidget);
    expect(find.text("INITIALIZING FUSION ENGINE..."), findsNothing);
  });

  testWidgets("shows the empty state when there are no available sources", (tester) async {
    final service = _FakeFusionConfigService();
    final container = _buildContainer(service);
    addTearDown(container.dispose);

    await tester.pumpWidget(
      _wrap(
        container,
        FusionConfigEngine(workspaceId: "ws1", availableSources: const [], onConfigSaved: () {}),
      ),
    );
    await tester.pumpAndSettle();

    expect(find.text("No log sources added to this workspace yet."), findsOneWidget);
  });

  testWidgets("toggling a source's checkbox flips its enabled state locally", (tester) async {
    final service = _FakeFusionConfigService();
    final container = _buildContainer(service);
    addTearDown(container.dispose);

    await tester.pumpWidget(
      _wrap(
        container,
        FusionConfigEngine(workspaceId: "ws1", availableSources: sources, onConfigSaved: () {}),
      ),
    );
    await tester.pumpAndSettle();

    expect(find.byIcon(Icons.check), findsOneWidget);

    await tester.tap(find.ancestor(of: find.byIcon(Icons.check), matching: find.byType(InkWell)));
    await tester.pump();

    expect(find.byIcon(Icons.check), findsNothing);
  });

  testWidgets("Deploy Fusion saves the current config and calls onConfigSaved", (tester) async {
    final service = _FakeFusionConfigService();
    final container = _buildContainer(service);
    addTearDown(container.dispose);
    var saved = false;

    await tester.pumpWidget(
      _wrap(
        container,
        FusionConfigEngine(
          workspaceId: "ws1",
          availableSources: sources,
          onConfigSaved: () => saved = true,
        ),
      ),
    );
    await tester.pumpAndSettle();

    await tester.tap(find.text("Deploy Fusion"));
    await tester.pumpAndSettle();

    expect(service.saveCalls, hasLength(1));
    expect(service.saveCalls.single.single.sourceId, "/var/log/a.log");
    expect(saved, isTrue);
    expect(find.text("Fusion orchestration updated."), findsOneWidget);
  });

  testWidgets("save failure surfaces an error toast instead of calling onConfigSaved", (tester) async {
    final service = _FakeFusionConfigService(throwOnSave: true);
    final container = _buildContainer(service);
    addTearDown(container.dispose);
    var saved = false;

    await tester.pumpWidget(
      _wrap(
        container,
        FusionConfigEngine(
          workspaceId: "ws1",
          availableSources: sources,
          onConfigSaved: () => saved = true,
        ),
      ),
    );
    await tester.pumpAndSettle();

    await tester.tap(find.text("Deploy Fusion"));
    await tester.pumpAndSettle();

    expect(saved, isFalse);
    expect(find.text("Failed to persist orchestration settings."), findsOneWidget);
  });

  testWidgets("the built-in parser fallback dialog saves a config and shows a confirmation", (tester) async {
    final service = _FakeFusionConfigService();
    final container = _buildContainer(service);
    addTearDown(container.dispose);

    await tester.pumpWidget(
      _wrap(
        container,
        FusionConfigEngine(workspaceId: "ws1", availableSources: sources, onConfigSaved: () {}),
      ),
    );
    await tester.pumpAndSettle();

    await tester.tap(find.byTooltip("Configure Extraction Parser"));
    await tester.pumpAndSettle();

    expect(find.text("Extraction Parser — /var/log/a.log"), findsOneWidget);

    await tester.enterText(find.byType(TextField), '{"regex":"foo"}');
    await tester.tap(find.text("Save"));
    await tester.pumpAndSettle();

    expect(find.text("Extraction pattern updated locally."), findsOneWidget);
  });
}
