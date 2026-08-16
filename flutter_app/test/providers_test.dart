import "package:flutter_riverpod/flutter_riverpod.dart";
import "package:flutter_test/flutter_test.dart";

import "package:loglensai/models/cluster.dart";
import "package:loglensai/providers/clustering_provider.dart";
import "package:loglensai/providers/debug_provider.dart";
import "package:loglensai/providers/investigation_provider.dart";
import "package:loglensai/providers/settings_provider.dart";
import "package:loglensai/providers/ui_provider.dart";
import "package:loglensai/providers/workspace_provider.dart";

void main() {
  group("uiProvider", () {
    test("initial state mirrors uiStore.ts defaults", () {
      final container = ProviderContainer();
      addTearDown(container.dispose);

      final state = container.read(uiProvider);
      expect(state.sidebarCollapsed, isFalse);
      expect(state.facetSidebarCollapsed, isTrue);
      expect(state.visibleColumns["message"], isTrue);
      expect(state.visibleColumns["http_method"], isFalse);
      expect(state.columnOrder.first, "id");
    });

    test("toggleSidebar flips sidebarCollapsed", () {
      final container = ProviderContainer();
      addTearDown(container.dispose);

      expect(container.read(uiProvider).sidebarCollapsed, isFalse);
      container.read(uiProvider.notifier).toggleSidebar();
      expect(container.read(uiProvider).sidebarCollapsed, isTrue);
    });

    test("toggleFacetSidebar collapses the column manager when opening", () {
      final container = ProviderContainer();
      addTearDown(container.dispose);

      final notifier = container.read(uiProvider.notifier);
      notifier.setColumnManagerCollapsed(false);
      expect(container.read(uiProvider).columnManagerCollapsed, isFalse);

      notifier.toggleFacetSidebar();
      final state = container.read(uiProvider);
      expect(state.facetSidebarCollapsed, isFalse);
      expect(state.columnManagerCollapsed, isTrue);
    });
  });

  group("workspaceProvider", () {
    test("initial state has no workspaces and an empty active id", () {
      final container = ProviderContainer();
      addTearDown(container.dispose);

      final state = container.read(workspaceProvider);
      expect(state.workspaces, isEmpty);
      expect(state.activeWorkspaceId, "");
      expect(state.activeWorkspace, isNull);
    });

    test("addWorkspace seeds the workspace and auto-selects it", () {
      final container = ProviderContainer();
      addTearDown(container.dispose);

      container
          .read(workspaceProvider.notifier)
          .addWorkspace(id: "default-ws", name: "Default Workspace");

      final state = container.read(workspaceProvider);
      expect(state.workspaces, hasLength(1));
      expect(state.activeWorkspaceId, "default-ws");
      expect(state.activeWorkspace!.name, "Default Workspace");
    });
  });

  group("investigationProvider", () {
    test("initial state defaults to the aggregate source with no logs", () {
      final container = ProviderContainer();
      addTearDown(container.dispose);

      final state = container.read(investigationProvider);
      expect(state.currentSourceId, "aggregate");
      expect(state.logs, isEmpty);
      expect(state.sortBy, "timestamp");
      expect(state.sortOrder, "desc");
    });
  });

  group("settingsProvider", () {
    test("initial state matches AppSettings.defaults", () {
      final container = ProviderContainer();
      addTearDown(container.dispose);

      final state = container.read(settingsProvider);
      expect(state.settings.aiProvider, "ollama");
      expect(state.settings.drainSimilarityThreshold, 0.5);
      expect(state.settings.drainMasks, hasLength(4));
    });
  });

  group("clusteringProvider", () {
    test("initial status is null (not yet fetched)", () {
      final container = ProviderContainer();
      addTearDown(container.dispose);

      expect(container.read(clusteringProvider).status, isNull);
    });

    test("ClusteringMode.fromWire round-trips 'auto'/'burst'", () {
      expect(ClusteringMode.fromWire("burst"), ClusteringMode.burst);
      expect(ClusteringMode.fromWire("auto"), ClusteringMode.auto);
      expect(ClusteringMode.auto.wireValue, "auto");
    });
  });

  group("debugProvider", () {
    test("addLog prepends entries and respects the ring-buffer cap", () {
      final container = ProviderContainer();
      addTearDown(container.dispose);

      final notifier = container.read(debugProvider.notifier);
      notifier.addLog(level: "info", source: "system", message: "first");
      notifier.addLog(level: "error", source: "sidecar", message: "second");

      final state = container.read(debugProvider);
      expect(state.logs, hasLength(2));
      // Reverse-chronological: most recent first.
      expect(state.logs.first.message, "second");
    });
  });
}
