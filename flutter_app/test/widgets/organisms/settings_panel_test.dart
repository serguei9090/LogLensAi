import "package:flutter/material.dart";
import "package:flutter/services.dart";
import "package:flutter_riverpod/flutter_riverpod.dart";
import "package:flutter_test/flutter_test.dart";

import "package:loglensai/providers/sidecar_provider.dart";
import "package:loglensai/providers/settings_provider.dart";
import "package:loglensai/services/sidecar_bridge.dart";
import "package:loglensai/theme/app_theme.dart";
import "package:loglensai/widgets/organisms/settings_panel.dart";

/// Fake [SidecarBridge] that answers every RPC in-memory and instantly --
/// `SettingsNotifier` is used unmodified against this fake (rather than
/// faking the notifier itself), so its real debounce/merge logic is
/// exercised, mirroring how `sidebar_test.dart`/`custom_parser_modal_test.dart`
/// fake the transport layer one level below the provider under test.
class _FakeBridge extends SidecarBridge {
  _FakeBridge({
    this.settingsResponse = const {},
    this.models = const <String>[],
    this.testResult = const {"status": "success", "message": "Connected."},
  });

  final Map<String, dynamic> settingsResponse;
  final List<String> models;
  final Map<String, dynamic> testResult;

  final List<String> calledMethods = [];
  final List<Map<String, dynamic>> updateSettingsPayloads = [];

  @override
  Future<T> call<T>(String method, [Map<String, dynamic> params = const {}]) async {
    calledMethods.add(method);
    switch (method) {
      case "get_settings":
        return settingsResponse as T;
      case "list_ai_models":
        return models as T;
      case "test_ai_connection":
        return testResult as T;
      case "update_settings":
        updateSettingsPayloads.add(Map<String, dynamic>.from(params["settings"] as Map));
        return null as T;
      default:
        return null as T;
    }
  }
}

ProviderContainer _buildContainer({_FakeBridge? bridge}) {
  return ProviderContainer(
    overrides: [sidecarBridgeProvider.overrideWithValue(bridge ?? _FakeBridge())],
  );
}

Widget _wrap(ProviderContainer container) {
  return UncontrolledProviderScope(
    container: container,
    child: MaterialApp(theme: AppTheme.dark, home: const Scaffold(body: SettingsPanel())),
  );
}

void main() {
  // The full settings form is much taller than the default 800x600 test
  // surface; widen it so every field/button in this file is actually
  // hit-testable without needing a scroll-into-view step per assertion,
  // mirroring `custom_parser_modal_test.dart`'s surface-resize setup.
  setUp(() {
    final binding = TestWidgetsFlutterBinding.ensureInitialized();
    binding.platformDispatcher.views.first.physicalSize = const Size(1400, 2600);
    binding.platformDispatcher.views.first.devicePixelRatio = 1.0;
  });
  tearDown(() {
    final binding = TestWidgetsFlutterBinding.ensureInitialized();
    binding.platformDispatcher.views.first.resetPhysicalSize();
    binding.platformDispatcher.views.first.resetDevicePixelRatio();
  });

  testWidgets("renders the AI section by default with the default provider selected", (tester) async {
    final container = _buildContainer();
    addTearDown(container.dispose);

    await tester.pumpWidget(_wrap(container));
    await tester.pumpAndSettle();

    expect(find.text("Settings"), findsOneWidget);
    expect(find.text("AI Intelligence"), findsWidgets);
    expect(find.text("Ollama"), findsOneWidget);
  });

  testWidgets("nav switches sections", (tester) async {
    final container = _buildContainer();
    addTearDown(container.dispose);

    await tester.pumpWidget(_wrap(container));
    await tester.pumpAndSettle();

    await tester.tap(find.text("Engine Core"));
    await tester.pumpAndSettle();
    expect(find.text("Global Core Engine (Drain3)"), findsOneWidget);

    await tester.tap(find.text("Ingestion"));
    await tester.pumpAndSettle();
    expect(find.text("Network Ingestion"), findsOneWidget);

    await tester.tap(find.text("Interface").first);
    await tester.pumpAndSettle();
    expect(find.text("Keyboard Shortcuts"), findsOneWidget);
  });

  testWidgets("editing the system prompt updates settingsProvider immediately", (tester) async {
    final container = _buildContainer();
    addTearDown(container.dispose);

    await tester.pumpWidget(_wrap(container));
    await tester.pumpAndSettle();

    final promptField = find.byWidgetPredicate(
      (w) => w is TextField && w.controller?.text.contains("root cause analysis") == true,
    );
    expect(promptField, findsOneWidget);

    await tester.enterText(promptField, "Custom system prompt.");
    await tester.pump();

    expect(container.read(settingsProvider).settings.aiSystemPrompt, "Custom system prompt.");

    // updateSettings() debounces its sidecar persistence by 500ms; let that
    // timer fire before the test tears the widget tree down, or
    // flutter_test's "Timer still pending" invariant check fails the test.
    await tester.pump(const Duration(milliseconds: 600));
  });

  testWidgets("changing the AI provider updates both provider and its default model", (tester) async {
    final container = _buildContainer();
    addTearDown(container.dispose);

    await tester.pumpWidget(_wrap(container));
    await tester.pumpAndSettle();

    expect(container.read(settingsProvider).settings.aiProvider, "ollama");

    await tester.tap(find.byType(DropdownButtonFormField<String>).first);
    await tester.pumpAndSettle();
    await tester.tap(find.text("OpenAI Compatible").last);
    await tester.pumpAndSettle();

    expect(container.read(settingsProvider).settings.aiProvider, "openai-compatible");
    expect(container.read(settingsProvider).settings.aiModel, "gpt-4o");

    await tester.pump(const Duration(milliseconds: 600));
  });

  testWidgets("the similarity slider updates drainSimilarityThreshold", (tester) async {
    final container = _buildContainer();
    addTearDown(container.dispose);

    await tester.pumpWidget(_wrap(container));
    await tester.pumpAndSettle();

    await tester.tap(find.text("Engine Core"));
    await tester.pumpAndSettle();

    expect(find.text("50% Sensitivity"), findsOneWidget);

    await tester.drag(find.byType(Slider), const Offset(200, 0));
    await tester.pump();

    expect(container.read(settingsProvider).settings.drainSimilarityThreshold, greaterThan(0.5));

    await tester.pump(const Duration(milliseconds: 600));
  });

  testWidgets("Add Custom Masking Instruction appends a new mask row", (tester) async {
    final container = _buildContainer();
    addTearDown(container.dispose);

    await tester.pumpWidget(_wrap(container));
    await tester.pumpAndSettle();

    await tester.tap(find.text("Engine Core"));
    await tester.pumpAndSettle();

    final before = container.read(settingsProvider).settings.drainMasks.length;

    await tester.tap(find.text("Add Custom Masking Instruction"));
    await tester.pump();

    expect(container.read(settingsProvider).settings.drainMasks.length, before + 1);
    expect(container.read(settingsProvider).settings.drainMasks.last.label, "NEW_MASK");

    await tester.pump(const Duration(milliseconds: 600));
  });

  testWidgets("Global Extraction Rules (FacetExtractionSettings) is embedded in the Drain section", (
    tester,
  ) async {
    final container = _buildContainer();
    addTearDown(container.dispose);

    await tester.pumpWidget(_wrap(container));
    await tester.pumpAndSettle();

    await tester.tap(find.text("Engine Core"));
    await tester.pumpAndSettle();

    expect(find.text("Global Extraction Rules"), findsOneWidget);
  });

  testWidgets("ingestion port fields update settingsProvider", (tester) async {
    final container = _buildContainer();
    addTearDown(container.dispose);

    await tester.pumpWidget(_wrap(container));
    await tester.pumpAndSettle();

    await tester.tap(find.text("Ingestion"));
    await tester.pumpAndSettle();

    final httpPortField = find.byWidgetPredicate(
      (w) => w is TextField && w.controller?.text == "5002",
    );
    expect(httpPortField, findsOneWidget);

    await tester.enterText(httpPortField, "9000");
    await tester.pump();

    expect(container.read(settingsProvider).settings.ingestionHttpPort, 9000);
    expect(find.textContaining("localhost:9000"), findsOneWidget);

    await tester.pump(const Duration(milliseconds: 600));
  });

  testWidgets("Reset Settings shows a confirmation and reverts to defaults on confirm", (tester) async {
    final bridge = _FakeBridge();
    final container = _buildContainer(bridge: bridge);
    addTearDown(container.dispose);

    await tester.pumpWidget(_wrap(container));
    await tester.pumpAndSettle();

    await tester.enterText(
      find.byWidgetPredicate((w) => w is TextField && w.controller?.text.contains("root cause analysis") == true),
      "Something custom",
    );
    await tester.pump();
    expect(container.read(settingsProvider).settings.aiSystemPrompt, "Something custom");

    await tester.tap(find.text("Reset Settings"));
    await tester.pumpAndSettle();

    expect(find.text("Reset All Settings?"), findsOneWidget);

    await tester.tap(find.text("Reset Everything"));
    await tester.pumpAndSettle();

    expect(
      container.read(settingsProvider).settings.aiSystemPrompt,
      contains("root cause analysis"),
    );
    expect(find.text("Settings reset to defaults successfully"), findsOneWidget);
  });

  testWidgets("loads remote settings (including JSON-encoded drain_masks) on mount", (tester) async {
    final bridge = _FakeBridge(
      settingsResponse: {
        "ai_provider": "lmstudio",
        "ai_model": "local-model",
        "drain_masks": '[{"label":"CUSTOM","pattern":"foo","enabled":true}]',
      },
    );
    final container = _buildContainer(bridge: bridge);
    addTearDown(container.dispose);

    await tester.pumpWidget(_wrap(container));
    await tester.pumpAndSettle();

    expect(container.read(settingsProvider).settings.aiProvider, "lmstudio");
    expect(bridge.calledMethods, contains("get_settings"));

    await tester.tap(find.text("Engine Core"));
    await tester.pumpAndSettle();

    expect(find.text("CUSTOM"), findsOneWidget);
  });

  testWidgets("a dynamic provider's fetched model list renders as a dropdown", (tester) async {
    final bridge = _FakeBridge(
      settingsResponse: const {"ai_provider": "ollama"},
      models: const ["llama3", "mistral"],
    );
    final container = _buildContainer(bridge: bridge);
    addTearDown(container.dispose);

    await tester.pumpWidget(_wrap(container));
    // A bare `pump()` first lets the mount-time `fetchSettings()` future
    // (started from a post-frame callback) resolve and reach the point
    // where it starts the model-fetch debounce timer; only then does
    // advancing the clock past that 1s debounce actually land on a
    // scheduled timer instead of racing ahead of it.
    await tester.pump();
    await tester.pump(const Duration(seconds: 2));
    await tester.pumpAndSettle();

    // The fetched list swaps the model field from a free-text entry to a
    // dropdown (provider selector first, model selector second); its
    // closed state only displays the *selected* value ("gemma4:e2b", the
    // default -- not in the fetched list, so it gets a synthetic extra
    // entry), so open it to see "llama3"/"mistral" as menu items.
    expect(find.byType(DropdownButtonFormField<String>), findsNWidgets(2));
    await tester.tap(find.byType(DropdownButtonFormField<String>).at(1));
    await tester.pumpAndSettle();

    expect(find.text("llama3"), findsOneWidget);
    expect(find.text("mistral"), findsOneWidget);
  });

  testWidgets("Test Connection surfaces the sidecar's status message", (tester) async {
    final bridge = _FakeBridge(
      settingsResponse: const {"ai_provider": "ollama"},
      testResult: const {"status": "success", "message": "Ollama reachable."},
    );
    final container = _buildContainer(bridge: bridge);
    addTearDown(container.dispose);

    await tester.pumpWidget(_wrap(container));
    await tester.pumpAndSettle();

    await tester.tap(find.text("Test Connection"));
    await tester.pumpAndSettle();

    expect(bridge.calledMethods, contains("test_ai_connection"));
    expect(find.text("Ollama reachable."), findsOneWidget);
  });

  testWidgets("keyboard shortcut capture records the next key press", (tester) async {
    final container = _buildContainer();
    addTearDown(container.dispose);

    await tester.pumpWidget(_wrap(container));
    await tester.pumpAndSettle();

    await tester.tap(find.text("Interface").first);
    await tester.pumpAndSettle();

    expect(find.text("Ctrl + K"), findsOneWidget);

    await tester.tap(find.text("Change Shortcut"));
    await tester.pump();
    expect(find.text("Press Any Key"), findsOneWidget);

    await tester.sendKeyDownEvent(LogicalKeyboardKey.keyP);
    await tester.pump();
    await tester.sendKeyUpEvent(LogicalKeyboardKey.keyP);
    await tester.pumpAndSettle();

    expect(container.read(settingsProvider).settings.uiCommandPaletteShortcut.key, "p");
    expect(find.text("P"), findsOneWidget);

    await tester.pump(const Duration(milliseconds: 600));
  });
}
