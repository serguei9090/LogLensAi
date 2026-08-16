import "package:flutter/material.dart";
import "package:flutter_riverpod/flutter_riverpod.dart";
import "package:flutter_test/flutter_test.dart";

import "package:loglensai/pages/settings_page.dart";
import "package:loglensai/providers/sidecar_provider.dart";
import "package:loglensai/services/sidecar_bridge.dart";
import "package:loglensai/theme/app_theme.dart";

/// Fake [SidecarBridge] that answers every RPC in-memory and instantly.
/// [SettingsPanel] calls `get_settings` from its `initState`, so this needs
/// to at least answer that method without a real sidecar -- mirrors
/// `settings_panel_test.dart`'s `_FakeBridge` (this page adds no RPC
/// behavior of its own, so the fake only needs to cover what the wrapped
/// organism calls).
class _FakeBridge extends SidecarBridge {
  final List<String> calledMethods = [];

  @override
  Future<T> call<T>(String method, [Map<String, dynamic> params = const {}]) async {
    calledMethods.add(method);
    switch (method) {
      case "get_settings":
        return <String, dynamic>{} as T;
      case "list_ai_models":
        return <String>[] as T;
      default:
        return null as T;
    }
  }
}

ProviderContainer _buildContainer() {
  return ProviderContainer(overrides: [sidecarBridgeProvider.overrideWithValue(_FakeBridge())]);
}

Widget _wrap(ProviderContainer container) {
  return UncontrolledProviderScope(
    container: container,
    child: MaterialApp(theme: AppTheme.dark, home: const SettingsPage()),
  );
}

void main() {
  // SettingsPanel's full form is taller than the default 800x600 test
  // surface, matching `settings_panel_test.dart`'s setup.
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

  testWidgets("renders the SettingsPanel organism inside a Scaffold", (tester) async {
    final container = _buildContainer();
    addTearDown(container.dispose);

    await tester.pumpWidget(_wrap(container));
    await tester.pumpAndSettle();

    expect(find.text("Settings"), findsOneWidget);
    expect(find.text("AI Intelligence"), findsWidgets);
    expect(find.byType(Scaffold), findsWidgets);
  });

  testWidgets("nav sections still switch when reached through the page wrapper", (tester) async {
    final container = _buildContainer();
    addTearDown(container.dispose);

    await tester.pumpWidget(_wrap(container));
    await tester.pumpAndSettle();

    await tester.tap(find.text("Engine Core"));
    await tester.pumpAndSettle();

    expect(find.text("Global Core Engine (Drain3)"), findsOneWidget);
  });
}
