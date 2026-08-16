/// Dart port of `src/components/pages/InvestigationPage.tsx` +
/// `src/components/templates/InvestigationLayout.tsx` (this codebase has no
/// separate templates tier -- see `app.dart`'s doc comment for the same
/// note about `AppLayout` -- so the layout is composed directly here).
///
/// Composes the already-built organism tier into the real Investigation
/// screen: [LogToolbar] (top), an optional [LogDistributionWidget] beneath
/// it, then a row of [FacetSidebar] + [ColumnManagerSidebar] (left) |
/// [VirtualLogTable] or [ExplorerView] (center, depending on whether a
/// source is selected) | [AIInvestigationSidebar] (right). Mounts
/// [CustomParserModal] (conditionally), [ImportFeedModal] (always, it
/// no-ops when closed), and launches [OrchestratorHub] via its own
/// `.show()` route helper.
///
/// This page also owns the log-fetching/ingestion orchestration that lives
/// in `src/lib/hooks/useLogFetching.ts` / `useLogIngestion.ts` in the React
/// source -- neither hook has a dedicated Flutter port yet (no
/// `useLogFetching`/`useLogIngestion` file exists under `lib/`), so their
/// logic is reproduced here as private page methods against
/// [sidecarBridgeProvider] directly. Simplifications versus the React hooks
/// (documented inline at each call site too):
///  - No `lastFetchedParamsRef`-style redundant-fetch suppression; `ref
///    .listen` triggers a fetch on every relevant state change. Simpler,
///    slightly more chatty, functionally equivalent for a desktop app with
///    no network-cost pressure.
///  - No 250ms `Future.wait`-vs-two-sequential-await distinction; both the
///    "full" (bounds+anomalies+facets+logs) and "partial" (logs-only) fetch
///    paths use `Future.wait` uniformly.
///  - Live-tail polling only runs a lightweight 1s log-refetch loop (mirrors
///    the React source's dedicated tailing `useEffect`); the *ingestion job*
///    polling loop is `ingestionProvider`'s documented single-fetch stand-in
///    (see that file's doc comment) rather than a self-rescheduling timer --
///    this page still calls `startPolling` at the same points the React
///    hooks do, so the moment a real interval loop lands in the provider,
///    this page needs zero changes.
///
/// Other deviations from the React source:
///  - `handleExport`'s native "Save As" dialog uses `package:file_picker`'s
///    `saveFile` (already a dependency, used by `NativeFilePicker`) instead
///    of `@tauri-apps/plugin-dialog`.
///  - `WorkspaceEngineSettings` (the Drain3 "Engine Settings" modal) has no
///    Flutter port -- it wasn't part of the 21-organism batch this pass
///    builds on top of. Every `onEngineSettingsOpen` callback in this page
///    is therefore left `null` (disables the corresponding button instead of
///    wiring to a modal that doesn't exist); see this migration pass's
///    report for the full note.
library;

import "dart:async";

import "package:file_picker/file_picker.dart";
import "package:flutter/material.dart";
import "package:flutter_riverpod/flutter_riverpod.dart";

import "../models/ingestion_job.dart";
import "../models/log_entry.dart";
import "../models/workspace.dart";
import "../providers/ai_provider.dart";
import "../providers/ingestion_provider.dart";
import "../providers/investigation_provider.dart";
import "../providers/settings_provider.dart";
import "../providers/sidecar_provider.dart";
import "../providers/workspace_provider.dart";
import "../widgets/molecules/highlight_builder.dart" show HighlightRule;
import "../widgets/organisms/ai_investigation_sidebar.dart";
import "../widgets/organisms/column_manager_sidebar.dart";
import "../widgets/organisms/custom_parser_modal.dart";
import "../widgets/organisms/explorer_view.dart";
import "../widgets/organisms/facet_sidebar.dart";
import "../widgets/organisms/import_feed_modal.dart";
import "../widgets/organisms/log_distribution_widget.dart";
import "../widgets/organisms/log_toolbar.dart";
import "../widgets/organisms/orchestrator_hub.dart";
import "../widgets/organisms/virtual_log_table.dart";

class InvestigationPage extends ConsumerStatefulWidget {
  const InvestigationPage({super.key});

  @override
  ConsumerState<InvestigationPage> createState() => _InvestigationPageState();
}

class _InvestigationPageState extends ConsumerState<InvestigationPage> {
  Set<String> _tailingSourceIds = {};
  Set<String> _anomalousClusters = {};
  bool _isFetching = false;
  bool _isConnected = true;
  String? _lastSourceKey;
  String? _activeParserSourceId;

  Timer? _searchDebounce;
  Timer? _tailFetchTimer;

  @override
  void initState() {
    super.initState();
    WidgetsBinding.instance.addPostFrameCallback((_) {
      final workspaceId = ref.read(workspaceProvider).activeWorkspaceId;
      if (workspaceId.isNotEmpty) {
        ref.read(settingsProvider.notifier).fetchSettings(workspaceId: workspaceId);
      }
      ref
          .read(investigationProvider.notifier)
          .syncActiveSource(ref.read(workspaceProvider).activeSource?.id);
      unawaited(_fetchLogs(forceFull: true));
    });
  }

  @override
  void dispose() {
    _searchDebounce?.cancel();
    _tailFetchTimer?.cancel();
    super.dispose();
  }

  void _showSnack(String message) {
    if (!mounted) return;
    ScaffoldMessenger.of(context).showSnackBar(SnackBar(content: Text(message)));
  }

  // ── Log fetching (port of useLogFetching.ts) ──────────────────────────

  ({bool isFusion, String? fusionId, List<Map<String, dynamic>> filters, LogSource src})?
  _queryParams() {
    final workspaceState = ref.read(workspaceProvider);
    final activeSourceId = workspaceState.activeSource?.id;
    if (activeSourceId == null) return null;
    LogSource? src;
    for (final s in workspaceState.activeWorkspace?.sources ?? const <LogSource>[]) {
      if (s.id == activeSourceId) {
        src = s;
        break;
      }
    }
    if (src == null) return null;
    final isFusion = src.type == "fusion";
    final investigation = ref.read(investigationProvider);
    final combined = <Map<String, dynamic>>[
      if (!isFusion) {"field": "source_id", "operator": "equals", "value": src.id},
      ...investigation.filters,
    ];
    return (isFusion: isFusion, fusionId: isFusion ? src.path : null, filters: combined, src: src);
  }

  Future<void> _fetchLogs({bool forceFull = false}) async {
    final workspaceState = ref.read(workspaceProvider);
    final workspaceId = workspaceState.activeWorkspaceId;
    final notifier = ref.read(investigationProvider.notifier);
    final qp = _queryParams();

    if (workspaceId.isEmpty || qp == null) {
      if (workspaceId.isNotEmpty) {
        notifier.setLogs(const [], 0);
        notifier.setAvailableFacets({});
      }
      return;
    }

    final investigation = ref.read(investigationProvider);
    final sourceKey = "${workspaceId}_${qp.src.id}";
    final shouldFetchAll = forceFull || _lastSourceKey != sourceKey;

    if (shouldFetchAll) {
      notifier.setLogs(const [], 0);
      notifier.setAvailableFacets({});
    }

    if (mounted) setState(() => _isFetching = true);
    final bridge = ref.read(sidecarBridgeProvider);

    try {
      final logsFuture = bridge.call<Map<String, dynamic>>(qp.isFusion ? "get_fused_logs" : "get_logs", {
        "workspace_id": workspaceId,
        if (qp.fusionId != null) "fusion_id": qp.fusionId,
        "offset": 0,
        "limit": 1000,
        if (investigation.searchQuery.isNotEmpty) "query": investigation.searchQuery,
        if (qp.filters.isNotEmpty) "filters": qp.filters,
        "sort_by": investigation.sortBy,
        "sort_order": investigation.sortOrder,
        if (investigation.timeRange.start.isNotEmpty) "start_time": investigation.timeRange.start,
        if (investigation.timeRange.end.isNotEmpty) "end_time": investigation.timeRange.end,
      });

      if (!shouldFetchAll) {
        final result = await logsFuture;
        if (!mounted) return;
        notifier.setLogs(_parseLogs(result), _parseTotal(result));
        setState(() => _isConnected = true);
        return;
      }

      final boundsFuture = bridge
          .call<Map<String, dynamic>>("get_time_boundaries", {
            "workspace_id": workspaceId,
            if (!qp.isFusion) "source_ids": [qp.src.id],
          })
          .catchError((Object _) => <String, dynamic>{});
      final anomaliesFuture = investigation.showAnomalies
          ? bridge.call<Map<String, dynamic>>("get_anomalies", {"workspace_id": workspaceId})
          : Future.value(<String, dynamic>{"anomalies": <dynamic>[]});
      final facetsFuture = bridge.call<Map<String, dynamic>>("get_metadata_facets", {
        "workspace_id": workspaceId,
        if (!qp.isFusion) "source_ids": [qp.src.id],
      });

      final results = await Future.wait([logsFuture, boundsFuture, anomaliesFuture, facetsFuture]);
      if (!mounted) return;

      final logResult = results[0];
      final bounds = results[1];
      final anomaliesRes = results[2];
      final facetRes = results[3];

      notifier.setLogs(_parseLogs(logResult), _parseTotal(logResult));

      final minTime = bounds["min_time"] as String?;
      final maxTime = bounds["max_time"] as String?;
      if (minTime != null && minTime.isNotEmpty && maxTime != null && maxTime.isNotEmpty) {
        final minIso = minTime.replaceFirst(" ", "T");
        final maxIso = maxTime.replaceFirst(" ", "T");
        notifier.setTimeRangeBounds(TimeRange(start: minIso, end: maxIso));
        if (investigation.timeRange.start.isEmpty && investigation.timeRange.end.isEmpty) {
          notifier.setTimeRange(TimeRange(start: minIso, end: maxIso, label: "All Time"));
        }
      }

      final anomaliesList = anomaliesRes["anomalies"] as List<dynamic>? ?? const [];
      final anomalousClusters = <String>{
        for (final a in anomaliesList) (a as Map<String, dynamic>)["cluster_id"]?.toString() ?? "",
      };

      final facets = <String, List<FacetValue>>{
        for (final entry in facetRes.entries)
          entry.key: (entry.value as List<dynamic>? ?? const [])
              .map((v) {
                final m = v as Map<String, dynamic>;
                return FacetValue(
                  value: m["value"]?.toString() ?? "",
                  count: (m["count"] as num?)?.toInt() ?? 0,
                );
              })
              .toList(),
      };
      notifier.setAvailableFacets(facets);

      _lastSourceKey = sourceKey;
      setState(() {
        _anomalousClusters = anomalousClusters;
        _isConnected = true;
      });
    } catch (_) {
      if (mounted) setState(() => _isConnected = false);
    } finally {
      if (mounted) setState(() => _isFetching = false);
    }
  }

  Future<void> _fetchMoreLogs() async {
    if (_isFetching) return;
    final workspaceState = ref.read(workspaceProvider);
    final workspaceId = workspaceState.activeWorkspaceId;
    final qp = _queryParams();
    if (workspaceId.isEmpty || qp == null) return;

    final investigation = ref.read(investigationProvider);
    if (investigation.logs.length >= investigation.total) return;

    if (mounted) setState(() => _isFetching = true);
    final bridge = ref.read(sidecarBridgeProvider);
    final notifier = ref.read(investigationProvider.notifier);
    try {
      final result = await bridge.call<Map<String, dynamic>>(qp.isFusion ? "get_fused_logs" : "get_logs", {
        "workspace_id": workspaceId,
        if (qp.fusionId != null) "fusion_id": qp.fusionId,
        "offset": investigation.logs.length,
        "limit": 1000,
        if (investigation.searchQuery.isNotEmpty) "query": investigation.searchQuery,
        if (qp.filters.isNotEmpty) "filters": qp.filters,
        "sort_by": investigation.sortBy,
        "sort_order": investigation.sortOrder,
        if (investigation.timeRange.start.isNotEmpty) "start_time": investigation.timeRange.start,
        if (investigation.timeRange.end.isNotEmpty) "end_time": investigation.timeRange.end,
      });
      if (!mounted) return;
      final more = _parseLogs(result);
      notifier.setLogs([...investigation.logs, ...more], _parseTotal(result, investigation.total));
      setState(() => _isConnected = true);
    } catch (_) {
      if (mounted) setState(() => _isConnected = false);
    } finally {
      if (mounted) setState(() => _isFetching = false);
    }
  }

  static List<LogEntry> _parseLogs(Map<String, dynamic> result) {
    final raw = result["logs"] as List<dynamic>? ?? const [];
    return raw.map((e) => LogEntry.fromJson(e as Map<String, dynamic>)).toList();
  }

  static int _parseTotal(Map<String, dynamic> result, [int fallback = 0]) =>
      (result["total"] as num?)?.toInt() ?? fallback;

  void _syncTailTimer(bool isTailing) {
    _tailFetchTimer?.cancel();
    _tailFetchTimer = null;
    if (isTailing) {
      _tailFetchTimer = Timer.periodic(const Duration(seconds: 1), (_) {
        if (!_isFetching) unawaited(_fetchLogs());
      });
    }
  }

  // ── Filter/highlight <-> molecule-type conversion ─────────────────────
  //
  // investigationProvider stores filters/highlights as raw
  // `List<Map<String, dynamic>>` (see that file's doc comment); the
  // FilterBuilder/HighlightBuilder molecules (and the LogToolbar/
  // VirtualLogTable organisms that embed them) want the typed `LogFilter`/
  // `HighlightRule` shapes instead. `LogFilter.toJson/fromJson` already
  // round-trips the exact `{field, value, operator}` shape used here;
  // highlight colors are stored as `#RRGGBB`/`#AARRGGBB` hex strings,
  // matching `template_codec.dart`'s established convention for the same
  // `{term, color}` shape.

  static List<LogFilter> _filtersFromState(List<Map<String, dynamic>> raw) =>
      raw.map(LogFilter.fromJson).toList();

  static List<Map<String, dynamic>> _filtersToState(List<LogFilter> filters) =>
      filters.map((f) => f.toJson()).toList();

  static List<HighlightRule> _highlightsFromState(List<Map<String, dynamic>> raw) => raw
      .map(
        (m) => HighlightRule(
          term: m["term"] as String? ?? "",
          color: _colorFromHex(m["color"] as String? ?? "#FBBF24"),
        ),
      )
      .toList();

  static List<Map<String, dynamic>> _highlightsToState(List<HighlightRule> rules) =>
      rules.map((r) => {"term": r.term, "color": _colorToHex(r.color)}).toList();

  static String _colorToHex(Color c) =>
      "#${c.toARGB32().toRadixString(16).padLeft(8, "0").substring(2)}";

  static Color _colorFromHex(String hex) {
    var s = hex.trim().replaceFirst("#", "");
    if (s.length == 6) s = "FF$s";
    final v = int.tryParse(s, radix: 16);
    return Color(v ?? 0xFFFBBF24);
  }

  // ── Manual-paste parsing (port of src/lib/log-utils.ts's parseManualLogs) ─

  static final RegExp _kManualTsRe = RegExp(r"^(\d{4}-\d{2}-\d{2}[T ]\d{2}:\d{2}:\d{2})\s*");
  static final RegExp _kManualLevelRe = RegExp(
    r"\b(ERROR|WARN|WARNING|INFO|DEBUG|TRACE|FATAL|CRITICAL)\b",
    caseSensitive: false,
  );

  static List<Map<String, dynamic>> _parseManualLogs(String raw) {
    return raw
        .split("\n")
        .map((l) => l.trim())
        .where((l) => l.isNotEmpty)
        .map((line) {
          final tsMatch = _kManualTsRe.firstMatch(line);
          final remainder = tsMatch != null ? line.substring(tsMatch.group(0)!.length) : line;
          final levelMatch = _kManualLevelRe.firstMatch(remainder);
          return {
            "raw_text": line,
            "timestamp": tsMatch?.group(1) ?? DateTime.now().toUtc().toIso8601String(),
            "level": levelMatch != null ? levelMatch.group(1)!.toUpperCase() : "INFO",
            "source_id": "manual",
          };
        })
        .toList();
  }

  // ── Source selection / removal / rename / sort ────────────────────────

  void _handleSelectSource(String? sourceId) {
    final workspaceId = ref.read(workspaceProvider).activeWorkspaceId;
    ref.read(workspaceProvider.notifier).setActiveSource(workspaceId, sourceId);
  }

  void _handleSort(String field) {
    final investigation = ref.read(investigationProvider);
    final nextOrder = (investigation.sortBy == field && investigation.sortOrder == "asc")
        ? "desc"
        : "asc";
    ref.read(investigationProvider.notifier).setSort(field, nextOrder);
  }

  Future<void> _handleRemoveSource(String sourceId) async {
    final workspaceState = ref.read(workspaceProvider);
    final workspaceId = workspaceState.activeWorkspaceId;
    LogSource? src;
    for (final s in workspaceState.activeWorkspace?.sources ?? const <LogSource>[]) {
      if (s.id == sourceId) {
        src = s;
        break;
      }
    }
    final bridge = ref.read(sidecarBridgeProvider);
    if (src != null && _tailingSourceIds.contains(sourceId)) {
      try {
        await bridge.call("stop_tail", {
          "filepath": src.path,
          "workspace_id": workspaceId,
          "source_id": src.id,
        });
      } catch (_) {
        /* Ignored, mirrors React source. */
      }
      if (mounted) {
        setState(() => _tailingSourceIds = {..._tailingSourceIds}..remove(sourceId));
      }
    }

    final wasActive = workspaceState.activeSource?.id == sourceId;
    await ref.read(workspaceProvider.notifier).removeSource(workspaceId, sourceId);

    if (wasActive) {
      ref.read(investigationProvider.notifier).setLogs(const [], 0);
      ref.read(investigationProvider.notifier).setAvailableFacets({});
    }

    try {
      await bridge.call("delete_logs", {"workspace_id": workspaceId, "source_id": sourceId});
      if (!wasActive) unawaited(_fetchLogs());
    } catch (_) {
      /* Ignored, mirrors React source (log-and-continue). */
    }
  }

  Future<void> _handleToggleTail(bool tail) async {
    final workspaceState = ref.read(workspaceProvider);
    final workspaceId = workspaceState.activeWorkspaceId;
    final activeSourceId = workspaceState.activeSource?.id;
    if (activeSourceId == null) {
      _showSnack("No active log source selected.");
      return;
    }
    LogSource? src;
    for (final s in workspaceState.activeWorkspace?.sources ?? const <LogSource>[]) {
      if (s.id == activeSourceId) {
        src = s;
        break;
      }
    }
    if (src == null) {
      _showSnack("Active source not found.");
      return;
    }

    final bridge = ref.read(sidecarBridgeProvider);
    final ingestionNotifier = ref.read(ingestionProvider.notifier);
    try {
      if (tail) {
        await bridge.call("start_tail", {
          "filepath": src.path,
          "workspace_id": workspaceId,
          "source_id": src.id,
        });
        if (mounted) setState(() => _tailingSourceIds = {..._tailingSourceIds, src!.id});
        ingestionNotifier.addLiveSource();
        unawaited(ingestionNotifier.startPolling(workspaceId));
        ref.read(investigationProvider.notifier).setTailing(true);
        _syncTailTimer(true);
        _showSnack("Live monitoring active for ${src.name}");
      } else {
        await bridge.call("stop_tail", {
          "filepath": src.path,
          "workspace_id": workspaceId,
          "source_id": src.id,
        });
        if (mounted) {
          setState(() => _tailingSourceIds = {..._tailingSourceIds}..remove(src!.id));
        }
        ingestionNotifier.removeLiveSource();
        ref.read(investigationProvider.notifier).setTailing(false);
        _syncTailTimer(false);
        _showSnack("Live monitoring stopped for ${src.name}");
      }
    } catch (_) {
      _showSnack("Failed to update monitoring state.");
    }
  }

  // ── Import modal launch + handlers (port of useLogIngestion.ts) ───────

  void _handleOpenImport() {
    final ingestionState = ref.read(ingestionProvider);
    if (!ingestionState.isImportProcessing) {
      ref.read(ingestionProvider.notifier).resetImportForm();
    }
    ref.read(ingestionProvider.notifier).setImportOpen(true);
  }

  Future<void> _handleImportLocal(String path, bool tail) async {
    final workspaceId = ref.read(workspaceProvider).activeWorkspaceId;
    if (workspaceId.isEmpty) return;
    final ingestionNotifier = ref.read(ingestionProvider.notifier);
    final workspaceNotifier = ref.read(workspaceProvider.notifier);
    final folderId = ref.read(workspaceProvider).activeWorkspace?.activeFolderId;
    ingestionNotifier.setImportProcessing(true);

    final normalizedPath = path.replaceAll("\\", "/");
    String? newSourceId;
    try {
      final newSource = await workspaceNotifier.createSource(
        workspaceId,
        LogSource(
          id: "",
          name: normalizedPath.split(RegExp(r"[\\/]")).lastWhere((_) => true, orElse: () => path),
          type: "local",
          path: normalizedPath,
        ),
        folderId: folderId,
      );
      newSourceId = newSource.id;
      workspaceNotifier.setActiveSource(workspaceId, newSource.id);
      ingestionNotifier.addTransitioningSource(newSource.id);
      ingestionNotifier.startIngestion(newSource.id);
      ref.read(investigationProvider.notifier).setLogs(const [], 0);

      final bridge = ref.read(sidecarBridgeProvider);
      await bridge.call("ingest_local_file", {
        "filepath": normalizedPath,
        "workspace_id": workspaceId,
        "source_id": newSource.id,
      });
      unawaited(ingestionNotifier.startPolling(workspaceId));

      if (tail) {
        await bridge.call("start_tail", {
          "filepath": normalizedPath,
          "workspace_id": workspaceId,
          "source_id": newSource.id,
        });
        ingestionNotifier.addLiveSource();
        if (mounted) {
          setState(() => _tailingSourceIds = {..._tailingSourceIds, newSource.id});
        }
        ref.read(investigationProvider.notifier).setTailing(true);
        _syncTailTimer(true);
        _showSnack("Live monitoring active for $path");
      }
      ingestionNotifier.setImportOpen(false);
    } catch (e) {
      if (newSourceId != null) {
        ingestionNotifier.removeTransitioningSource(newSourceId);
        ingestionNotifier.stopIngestion(newSourceId);
      }
      _showSnack("Failed to import file.");
    } finally {
      ingestionNotifier.setImportProcessing(false);
    }
  }

  Future<void> _handleImportSSH(
    String host,
    int port,
    String user,
    String pass,
    String path,
    bool tail,
  ) async {
    final workspaceId = ref.read(workspaceProvider).activeWorkspaceId;
    if (workspaceId.isEmpty) return;
    final ingestionNotifier = ref.read(ingestionProvider.notifier);
    final workspaceNotifier = ref.read(workspaceProvider.notifier);
    final folderId = ref.read(workspaceProvider).activeWorkspace?.activeFolderId;
    ingestionNotifier.setImportProcessing(true);

    final connectionPath = "$user@$host:$path";
    String? newSourceId;
    try {
      final newSource = await workspaceNotifier.createSource(
        workspaceId,
        LogSource(
          id: "",
          name: "$host: ${path.split('/').lastWhere((_) => true, orElse: () => path)}",
          type: "ssh",
          path: connectionPath,
        ),
        folderId: folderId,
      );
      newSourceId = newSource.id;
      workspaceNotifier.setActiveSource(workspaceId, newSource.id);

      if (!tail) {
        _showSnack("Non-tail SSH import is not yet supported. Enable Live Stream.");
        return;
      }

      ingestionNotifier.addTransitioningSource(newSource.id);
      ingestionNotifier.startIngestion(newSource.id);
      ref.read(investigationProvider.notifier).setLogs(const [], 0);

      final bridge = ref.read(sidecarBridgeProvider);
      await bridge.call("start_ssh_tail", {
        "host": host,
        "port": port,
        "username": user,
        "password": pass,
        "filepath": path,
        "workspace_id": workspaceId,
        "folder_id": folderId,
      });

      ingestionNotifier.addLiveSource();
      unawaited(ingestionNotifier.startPolling(workspaceId));
      if (mounted) {
        setState(() => _tailingSourceIds = {..._tailingSourceIds, newSource.id});
      }
      ref.read(investigationProvider.notifier).setTailing(true);
      _syncTailTimer(true);
      _showSnack("SSH tailing started for $connectionPath");
      ingestionNotifier.setImportOpen(false);
    } catch (e) {
      if (newSourceId != null) {
        ingestionNotifier.removeTransitioningSource(newSourceId);
        ingestionNotifier.stopIngestion(newSourceId);
      }
      _showSnack("SSH connection failed.");
    } finally {
      ingestionNotifier.setImportProcessing(false);
    }
  }

  Future<void> _handleIngestManual(String logs) async {
    final workspaceId = ref.read(workspaceProvider).activeWorkspaceId;
    if (workspaceId.isEmpty) return;
    final ingestionNotifier = ref.read(ingestionProvider.notifier);
    final workspaceNotifier = ref.read(workspaceProvider.notifier);
    final folderId = ref.read(workspaceProvider).activeWorkspace?.activeFolderId;
    ingestionNotifier.setImportProcessing(true);

    String? newSourceId;
    try {
      final newSource = await workspaceNotifier.createSource(
        workspaceId,
        LogSource(
          id: "",
          name: "Paste (${DateTime.now().toIso8601String()})",
          type: "manual",
          path: "manual-buffer",
        ),
        folderId: folderId,
      );
      newSourceId = newSource.id;
      workspaceNotifier.setActiveSource(workspaceId, newSource.id);

      final entries = _parseManualLogs(
        logs,
      ).map((e) => {...e, "workspace_id": workspaceId, "source_id": newSource.id}).toList();

      if (entries.isEmpty) {
        _showSnack("Manual buffer is empty or invalid.");
        return;
      }

      ingestionNotifier.addTransitioningSource(newSource.id);
      ingestionNotifier.startIngestion(newSource.id);
      ref.read(investigationProvider.notifier).setLogs(const [], 0);

      final bridge = ref.read(sidecarBridgeProvider);
      await bridge.call("ingest_logs", {"logs": entries});
      unawaited(ingestionNotifier.startPolling(workspaceId));
      ingestionNotifier.setImportOpen(false);
    } catch (e) {
      if (newSourceId != null) {
        ingestionNotifier.removeTransitioningSource(newSourceId);
        ingestionNotifier.stopIngestion(newSourceId);
      }
      _showSnack("Manual ingestion failed.");
    } finally {
      ingestionNotifier.setImportProcessing(false);
    }
  }

  Future<void> _handleImportLive(String name, {required bool syslog, required bool http}) async {
    final workspaceId = ref.read(workspaceProvider).activeWorkspaceId;
    if (workspaceId.isEmpty) return;
    final ingestionNotifier = ref.read(ingestionProvider.notifier);
    final workspaceNotifier = ref.read(workspaceProvider.notifier);
    final folderId = ref.read(workspaceProvider).activeWorkspace?.activeFolderId;
    final settings = ref.read(settingsProvider).settings;
    final bridge = ref.read(sidecarBridgeProvider);
    ingestionNotifier.setImportProcessing(true);

    try {
      final futures = <Future<void>>[
        if (syslog)
          bridge.call("create_log_stream", {
            "workspace_id": workspaceId,
            "type": "syslog",
            "name": name,
            "port": settings.ingestionSyslogPort,
          }),
        if (http)
          bridge.call("create_log_stream", {
            "workspace_id": workspaceId,
            "type": "http",
            "name": name,
            "port": settings.ingestionHttpPort,
          }),
      ];
      await Future.wait(futures);

      final newSource = await workspaceNotifier.createSource(
        workspaceId,
        LogSource(id: "", name: name, type: "live", path: name),
        folderId: folderId,
      );
      workspaceNotifier.setActiveSource(workspaceId, newSource.id);

      final streamCount = (syslog ? 1 : 0) + (http ? 1 : 0);
      for (var i = 0; i < streamCount; i++) {
        ingestionNotifier.addLiveSource();
      }
      unawaited(ingestionNotifier.startPolling(workspaceId));
      _showSnack('Live collection "$name" active');
      ingestionNotifier.setImportOpen(false);
    } catch (e) {
      _showSnack("Failed to start live collection.");
    } finally {
      ingestionNotifier.setImportProcessing(false);
    }
  }

  // ── Orchestrator / fusion ──────────────────────────────────────────────

  void _handleOrchestrateOpen() {
    final workspaceState = ref.read(workspaceProvider);
    final nonFusionSources = (workspaceState.activeWorkspace?.sources ?? const <LogSource>[])
        .where((s) => s.type != "fusion")
        .toList();
    unawaited(
      OrchestratorHub.show(
        context,
        workspaceId: workspaceState.activeWorkspaceId,
        availableSources: nonFusionSources,
        onFusionSaved: _handleFusionSaved,
      ),
    );
  }

  void _handleEditFusion(String sourceId) {
    final workspaceState = ref.read(workspaceProvider);
    LogSource? src;
    for (final s in workspaceState.activeWorkspace?.sources ?? const <LogSource>[]) {
      if (s.id == sourceId) {
        src = s;
        break;
      }
    }
    if (src == null) return;
    final nonFusionSources = (workspaceState.activeWorkspace?.sources ?? const <LogSource>[])
        .where((s) => s.type != "fusion")
        .toList();
    unawaited(
      OrchestratorHub.show(
        context,
        workspaceId: workspaceState.activeWorkspaceId,
        availableSources: nonFusionSources,
        onFusionSaved: _handleFusionSaved,
        editingFusionId: src.path,
        editingFusionName: src.name,
      ),
    );
  }

  Future<void> _handleFusionSaved(
    String fusionId,
    String fusionName,
    List<Map<String, dynamic>> configs,
  ) async {
    final workspaceState = ref.read(workspaceProvider);
    final workspaceNotifier = ref.read(workspaceProvider.notifier);
    LogSource? existing;
    for (final s in workspaceState.activeWorkspace?.sources ?? const <LogSource>[]) {
      if (s.path == fusionId) {
        existing = s;
        break;
      }
    }
    if (existing != null) {
      await workspaceNotifier.renameSource(workspaceState.activeWorkspaceId, existing.id, fusionName);
    } else {
      final newSrc = await workspaceNotifier.createSource(
        workspaceState.activeWorkspaceId,
        LogSource(id: "", name: fusionName, type: "fusion", path: fusionId),
      );
      workspaceNotifier.setActiveSource(workspaceState.activeWorkspaceId, newSrc.id);
    }
  }

  // ── Export ──────────────────────────────────────────────────────────

  Future<void> _handleExport() async {
    final workspaceState = ref.read(workspaceProvider);
    final workspaceId = workspaceState.activeWorkspaceId;
    if (workspaceId.isEmpty) return;
    final activeSrc = workspaceState.activeSource;
    final isFusion = activeSrc?.type == "fusion";

    final defaultName = "loglens_export_${DateTime.now().toIso8601String().split('T').first}.csv";
    String? path;
    try {
      path = await FilePicker.platform.saveFile(
        dialogTitle: "Export Logs",
        fileName: defaultName,
        type: FileType.custom,
        allowedExtensions: const ["csv", "json"],
      );
    } catch (_) {
      path = null;
    }
    if (path == null || path.isEmpty) return;

    final format = path.endsWith(".json") ? "json" : "csv";
    final investigation = ref.read(investigationProvider);
    final bridge = ref.read(sidecarBridgeProvider);
    try {
      await bridge.call("export_logs", {
        "workspace_id": workspaceId,
        "filepath": path,
        "format": format,
        if (investigation.searchQuery.isNotEmpty) "query": investigation.searchQuery,
        if (investigation.filters.isNotEmpty) "filters": investigation.filters,
        "fusion_id": isFusion ? activeSrc!.path : null,
        if (investigation.timeRange.start.isNotEmpty) "start_time": investigation.timeRange.start,
        if (investigation.timeRange.end.isNotEmpty) "end_time": investigation.timeRange.end,
      });
      _showSnack("Export complete: saved to $path");
    } catch (_) {
      _showSnack("Export failed.");
    }
  }

  // ── Row comment / cluster analysis / parser modal ─────────────────────

  Future<void> _handleAddComment(int id, String comment) async {
    final hasComment = comment.trim().isNotEmpty;
    final investigation = ref.read(investigationProvider);
    LogEntry? original;
    for (final l in investigation.logs) {
      if (l.id == id) {
        original = l;
        break;
      }
    }
    final notifier = ref.read(investigationProvider.notifier);
    notifier.updateLog(id, (l) => l.copyWith(comment: comment, hasComment: hasComment));
    try {
      await ref.read(sidecarBridgeProvider).call("update_log_comment", {
        "log_id": id,
        "comment": comment,
      });
      _showSnack("Annotation saved");
    } catch (_) {
      final o = original;
      if (o != null) {
        notifier.updateLog(id, (l) => l.copyWith(comment: o.comment, hasComment: o.hasComment));
      }
      _showSnack("Failed to save annotation");
    }
  }

  Future<void> _handleAnalyzeCluster(String clusterId) async {
    final investigation = ref.read(investigationProvider);
    final clusterLogs = investigation.logs.where((l) => l.clusterId == clusterId).toList();
    if (clusterLogs.isEmpty) {
      _showSnack("No logs found for cluster #$clusterId");
      return;
    }
    final logIds = clusterLogs.take(5).map((l) => l.id).toList();
    final template = clusterLogs.first.clusterTemplate ?? "N/A";

    final aiNotifier = ref.read(aiProvider.notifier);
    aiNotifier.setSession(null);
    aiNotifier.setSidebarOpen(true);

    final workspaceId = ref.read(workspaceProvider).activeWorkspaceId;
    final prompt =
        'Analyze log cluster #$clusterId (${logIds.length} logs, template: "$template"). '
        "What pattern do these logs represent? Are there any anomalies, errors, or performance "
        "concerns? Provide a root cause analysis and recommended actions.";

    await aiNotifier.sendMessage(
      SendMessageParams(
        workspaceId: workspaceId,
        message: prompt,
        contextLogs: logIds,
        sessionName: "Cluster #$clusterId",
      ),
    );
  }

  Future<void> _handleParserSaved(String configJson) async {
    final workspaceId = ref.read(workspaceProvider).activeWorkspaceId;
    final sourceId = _activeParserSourceId;
    if (sourceId != null) {
      try {
        await ref.read(sidecarBridgeProvider).call("update_source_parser", {
          "workspace_id": workspaceId,
          "source_id": sourceId,
          "parser_config": configJson,
        });
        _showSnack("Log parser re-calibrated.");
        unawaited(_fetchLogs(forceFull: true));
      } catch (_) {
        _showSnack("Failed to update log parser.");
      }
    }
    if (mounted) setState(() => _activeParserSourceId = null);
  }

  // ── Build ────────────────────────────────────────────────────────────

  @override
  Widget build(BuildContext context) {
    final workspaceState = ref.watch(workspaceProvider);
    final investigation = ref.watch(investigationProvider);
    final ingestionState = ref.watch(ingestionProvider);
    final activeWorkspaceId = workspaceState.activeWorkspaceId;
    final activeWorkspace = workspaceState.activeWorkspace;
    final activeSourceId = activeWorkspace?.activeSourceId;
    final sources = activeWorkspace?.sources ?? const <LogSource>[];

    ref.listen<String?>(workspaceProvider.select((s) => s.activeSource?.id), (prev, next) {
      if (prev == next) return;
      ref.read(investigationProvider.notifier).syncActiveSource(next);
      final nowTailing = next != null && _tailingSourceIds.contains(next);
      ref.read(investigationProvider.notifier).setTailing(nowTailing);
      _syncTailTimer(nowTailing);
      unawaited(_fetchLogs());
    });
    ref.listen<String>(workspaceProvider.select((s) => s.activeWorkspaceId), (prev, next) {
      if (prev == next || next.isEmpty) return;
      ref.read(investigationProvider.notifier).setLogs(const [], 0);
      ref.read(investigationProvider.notifier).setAvailableFacets({});
      ref
          .read(investigationProvider.notifier)
          .setTimeRange(const TimeRange(start: "", end: "", label: "All Time"));
      unawaited(ref.read(settingsProvider.notifier).fetchSettings(workspaceId: next));
    });
    ref.listen<String>(investigationProvider.select((s) => s.searchQuery), (prev, next) {
      _searchDebounce?.cancel();
      _searchDebounce = Timer(const Duration(milliseconds: 250), () {
        if (mounted) unawaited(_fetchLogs());
      });
    });
    ref.listen(investigationProvider.select((s) => s.filters), (prev, next) => unawaited(_fetchLogs()));
    ref.listen(investigationProvider.select((s) => s.sortBy), (prev, next) => unawaited(_fetchLogs()));
    ref.listen(
      investigationProvider.select((s) => s.sortOrder),
      (prev, next) => unawaited(_fetchLogs()),
    );
    ref.listen(
      investigationProvider.select((s) => s.timeRange),
      (prev, next) => unawaited(_fetchLogs()),
    );
    ref.listen<bool>(
      investigationProvider.select((s) => s.showAnomalies),
      (prev, next) => unawaited(_fetchLogs(forceFull: true)),
    );

    LogSource? activeSource;
    for (final s in sources) {
      if (s.id == activeSourceId) {
        activeSource = s;
        break;
      }
    }
    final showDistribution = investigation.showDistribution && activeSourceId != null;

    IngestionJob? activeJobForSource;
    var isSourceLoading = false;
    if (activeSourceId != null) {
      for (final j in ingestionState.jobs) {
        if (j.sourceId == activeSourceId && j.isActive) {
          activeJobForSource = j;
          break;
        }
      }
      isSourceLoading =
          ingestionState.ingestingSourceIds.contains(activeSourceId) ||
          ingestionState.transitioningSourceIds.contains(activeSourceId) ||
          activeJobForSource != null ||
          ingestionState.retrievingSourceIds.contains(activeSourceId) ||
          (_isFetching && investigation.logs.isEmpty);
    }

    return Stack(
      children: [
        Column(
          children: [
            LogToolbar(
              searchQuery: investigation.searchQuery,
              onSearch: (v) => ref.read(investigationProvider.notifier).setSearchQuery(v),
              activeFilters: _filtersFromState(investigation.filters),
              onFilterChange: (f) =>
                  ref.read(investigationProvider.notifier).setFilters(_filtersToState(f)),
              activeHighlights: _highlightsFromState(investigation.highlights),
              onHighlightChange: (h) =>
                  ref.read(investigationProvider.notifier).setHighlights(_highlightsToState(h)),
              isTailing: activeSourceId != null && _tailingSourceIds.contains(activeSourceId),
              onTailToggle: _handleToggleTail,
              status: _isConnected,
              onImportOpen: _handleOpenImport,
              onOrchestrateOpen: _handleOrchestrateOpen,
              onExport: _handleExport,
              sources: sources,
              activeSourceId: activeSourceId,
              tailingSourceIds: _tailingSourceIds,
              onSelectSource: _handleSelectSource,
              onRemoveSource: (id) => unawaited(_handleRemoveSource(id)),
              onEditFusion: _handleEditFusion,
              onRenameSource: (workspaceId, sourceId, name) => unawaited(
                ref.read(workspaceProvider.notifier).renameSource(workspaceId, sourceId, name),
              ),
              activeWorkspaceId: activeWorkspaceId,
            ),
            if (showDistribution)
              LogDistributionWidget(
                workspaceId: activeWorkspaceId,
                sourceIds: (activeSource != null && activeSource.type != "fusion")
                    ? [activeSource.id]
                    : null,
                fusionId: activeSource?.type == "fusion" ? activeSource!.path : null,
                isTailing: _tailingSourceIds.contains(activeSourceId),
                filters: investigation.filters,
                query: investigation.searchQuery,
                onClose: () => ref
                    .read(investigationProvider.notifier)
                    .setShowDistribution(!investigation.showDistribution),
              ),
            Expanded(
              child: Row(
                crossAxisAlignment: CrossAxisAlignment.stretch,
                children: [
                  const FacetSidebar(),
                  const ColumnManagerSidebar(),
                  Expanded(
                    child: activeSourceId != null
                        ? VirtualLogTable(
                            logs: investigation.logs,
                            highlights: _highlightsFromState(investigation.highlights),
                            sortBy: investigation.sortBy,
                            sortOrder: investigation.sortOrder,
                            onSort: _handleSort,
                            anomalousClusters: _anomalousClusters,
                            activeJob: activeJobForSource,
                            isTransitioning: isSourceLoading,
                            fetchMoreLogs: () => unawaited(_fetchMoreLogs()),
                            total: investigation.total,
                            isFetching: _isFetching,
                            onAddComment: (id, comment) => unawaited(_handleAddComment(id, comment)),
                            onAnalyzeCluster: (id) => unawaited(_handleAnalyzeCluster(id)),
                            onOpenParser: (sourceId, initialConfig) =>
                                setState(() => _activeParserSourceId = sourceId),
                            onImport: _handleOpenImport,
                          )
                        : ExplorerView(
                            folderId: activeWorkspace?.activeFolderId,
                            hierarchy: activeWorkspace?.hierarchy,
                            onSelectFolder: (id) => ref
                                .read(workspaceProvider.notifier)
                                .setActiveFolder(activeWorkspaceId, id),
                            onSelectSource: (id) => ref
                                .read(workspaceProvider.notifier)
                                .setActiveSource(activeWorkspaceId, id),
                            onCreateFolder: (name) => unawaited(
                              ref
                                  .read(workspaceProvider.notifier)
                                  .createFolder(
                                    activeWorkspaceId,
                                    name,
                                    parentId: activeWorkspace?.activeFolderId,
                                  ),
                            ),
                            onImportOpen: _handleOpenImport,
                            workspaceName: activeWorkspace?.name,
                            onRenameFolder: (id, name) =>
                                ref.read(workspaceProvider.notifier).renameFolder(id, name),
                            onDeleteFolder: (id) =>
                                ref.read(workspaceProvider.notifier).deleteFolder(id),
                            onRenameSource: (id, name) => unawaited(
                              ref
                                  .read(workspaceProvider.notifier)
                                  .renameSource(activeWorkspaceId, id, name),
                            ),
                            onDeleteSource: (id) => unawaited(_handleRemoveSource(id)),
                          ),
                  ),
                  // No Flutter port of `WorkspaceEngineSettings` exists yet
                  // (see this file's doc comment) -- `onEngineSettingsOpen`
                  // is left unset, which simply disables the corresponding
                  // "Engine Settings" button inside this organism.
                  const AIInvestigationSidebar(),
                ],
              ),
            ),
          ],
        ),
        if (_activeParserSourceId != null)
          CustomParserModal(
            workspaceId: activeWorkspaceId,
            sourceId: _activeParserSourceId!,
            isOpen: true,
            onClose: () => setState(() => _activeParserSourceId = null),
            onSaved: (cfg) => unawaited(_handleParserSaved(cfg)),
          ),
        ImportFeedModal(
          onImportLocal: (path, tail) => unawaited(_handleImportLocal(path, tail)),
          onImportSSH: (host, port, user, pass, path, tail) =>
              unawaited(_handleImportSSH(host, port, user, pass, path, tail)),
          onIngestManual: (logs) => unawaited(_handleIngestManual(logs)),
          onImportLive: (name, {required syslog, required http}) =>
              unawaited(_handleImportLive(name, syslog: syslog, http: http)),
        ),
      ],
    );
  }
}
