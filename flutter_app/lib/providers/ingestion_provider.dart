/// Port of `src/store/ingestionStore.ts` (`useIngestionStore`).
///
/// The TS store's cross-workspace polling scheduler + job-completion
/// orchestration (hierarchy refresh -> clear state -> stop ingestion ->
/// dispatch a DOM event) is substantial UI-glue logic that depends on
/// other stores/pages that don't exist in Flutter yet. This port carries
/// the full state shape and the same action names/signatures so later
/// passes can drop in the real polling loop; [startPolling] currently does
/// a single [fetchJobs] call rather than the TS version's adaptive
/// self-rescheduling `setTimeout` loop -- flagged as a follow-up.
library;

import "package:flutter_riverpod/flutter_riverpod.dart";

import "../models/ingestion_job.dart";
import "../services/sidecar_bridge.dart";
import "sidecar_provider.dart";

class IngestionState {
  const IngestionState({
    this.jobs = const [],
    this.activeJob,
    this.lastJob,
    this.isPolling = false,
    this.liveSourceCount = 0,
    this.error,
    this.ingestingSourceIds = const [],
    this.transitioningSourceIds = const {},
    this.notifiedJobIds = const {},
    this.handledJobIds = const {},
    this.retrievingSourceIds = const {},
    // Import Feed Modal state
    this.isImportOpen = false,
    this.isImportProcessing = false,
    this.importActiveTab = "local",
    this.importLocalPath = "",
    this.importLocalTail = false,
    this.importSshHost = "",
    this.importSshPort = "22",
    this.importSshUser = "",
    this.importSshPass = "",
    this.importSshPath = "",
    this.importSshTail = false,
    this.importManualLogs = "",
    this.importLiveName = "",
    this.importLiveSyslog = true,
    this.importLiveHttp = true,
  });

  final List<IngestionJob> jobs;
  final IngestionJob? activeJob;
  final IngestionJob? lastJob;
  final bool isPolling;
  final int liveSourceCount;
  final String? error;
  final List<String> ingestingSourceIds;
  final Set<String> transitioningSourceIds;
  final Set<int> notifiedJobIds;
  final Set<int> handledJobIds;
  final Set<String> retrievingSourceIds;

  final bool isImportOpen;
  final bool isImportProcessing;
  final String importActiveTab; // 'local' | 'ssh' | 'manual' | 'live'
  final String importLocalPath;
  final bool importLocalTail;
  final String importSshHost;
  final String importSshPort;
  final String importSshUser;
  final String importSshPass;
  final String importSshPath;
  final bool importSshTail;
  final String importManualLogs;
  final String importLiveName;
  final bool importLiveSyslog;
  final bool importLiveHttp;

  IngestionState copyWith({
    List<IngestionJob>? jobs,
    Object? activeJob = _unset,
    Object? lastJob = _unset,
    bool? isPolling,
    int? liveSourceCount,
    Object? error = _unset,
    List<String>? ingestingSourceIds,
    Set<String>? transitioningSourceIds,
    Set<int>? notifiedJobIds,
    Set<int>? handledJobIds,
    Set<String>? retrievingSourceIds,
    bool? isImportOpen,
    bool? isImportProcessing,
    String? importActiveTab,
    String? importLocalPath,
    bool? importLocalTail,
    String? importSshHost,
    String? importSshPort,
    String? importSshUser,
    String? importSshPass,
    String? importSshPath,
    bool? importSshTail,
    String? importManualLogs,
    String? importLiveName,
    bool? importLiveSyslog,
    bool? importLiveHttp,
  }) {
    return IngestionState(
      jobs: jobs ?? this.jobs,
      activeJob: identical(activeJob, _unset) ? this.activeJob : activeJob as IngestionJob?,
      lastJob: identical(lastJob, _unset) ? this.lastJob : lastJob as IngestionJob?,
      isPolling: isPolling ?? this.isPolling,
      liveSourceCount: liveSourceCount ?? this.liveSourceCount,
      error: identical(error, _unset) ? this.error : error as String?,
      ingestingSourceIds: ingestingSourceIds ?? this.ingestingSourceIds,
      transitioningSourceIds: transitioningSourceIds ?? this.transitioningSourceIds,
      notifiedJobIds: notifiedJobIds ?? this.notifiedJobIds,
      handledJobIds: handledJobIds ?? this.handledJobIds,
      retrievingSourceIds: retrievingSourceIds ?? this.retrievingSourceIds,
      isImportOpen: isImportOpen ?? this.isImportOpen,
      isImportProcessing: isImportProcessing ?? this.isImportProcessing,
      importActiveTab: importActiveTab ?? this.importActiveTab,
      importLocalPath: importLocalPath ?? this.importLocalPath,
      importLocalTail: importLocalTail ?? this.importLocalTail,
      importSshHost: importSshHost ?? this.importSshHost,
      importSshPort: importSshPort ?? this.importSshPort,
      importSshUser: importSshUser ?? this.importSshUser,
      importSshPass: importSshPass ?? this.importSshPass,
      importSshPath: importSshPath ?? this.importSshPath,
      importSshTail: importSshTail ?? this.importSshTail,
      importManualLogs: importManualLogs ?? this.importManualLogs,
      importLiveName: importLiveName ?? this.importLiveName,
      importLiveSyslog: importLiveSyslog ?? this.importLiveSyslog,
      importLiveHttp: importLiveHttp ?? this.importLiveHttp,
    );
  }
}

const Object _unset = Object();

class IngestionNotifier extends StateNotifier<IngestionState> {
  IngestionNotifier(this._bridge) : super(const IngestionState());

  final SidecarBridge _bridge;

  // ── Import modal field setters ──────────────────────────────────────
  void setImportOpen(bool open) => state = state.copyWith(isImportOpen: open);
  void setImportProcessing(bool p) => state = state.copyWith(isImportProcessing: p);
  void setImportActiveTab(String tab) => state = state.copyWith(importActiveTab: tab);
  void setImportLocalPath(String path) => state = state.copyWith(importLocalPath: path);
  void setImportLocalTail(bool tail) => state = state.copyWith(importLocalTail: tail);
  void setImportSshHost(String host) => state = state.copyWith(importSshHost: host);
  void setImportSshPort(String port) => state = state.copyWith(importSshPort: port);
  void setImportSshUser(String user) => state = state.copyWith(importSshUser: user);
  void setImportSshPass(String pass) => state = state.copyWith(importSshPass: pass);
  void setImportSshPath(String path) => state = state.copyWith(importSshPath: path);
  void setImportSshTail(bool tail) => state = state.copyWith(importSshTail: tail);
  void setImportManualLogs(String logs) => state = state.copyWith(importManualLogs: logs);
  void setImportLiveName(String name) => state = state.copyWith(importLiveName: name);
  void setImportLiveSyslog(bool v) => state = state.copyWith(importLiveSyslog: v);
  void setImportLiveHttp(bool v) => state = state.copyWith(importLiveHttp: v);

  void resetImportForm() {
    state = state.copyWith(
      importLocalPath: "",
      importLocalTail: false,
      importSshHost: "",
      importSshPort: "22",
      importSshUser: "",
      importSshPass: "",
      importSshPath: "",
      importSshTail: false,
      importManualLogs: "",
      importLiveName: "",
      importLiveSyslog: true,
      importLiveHttp: true,
      importActiveTab: "local",
    );
  }

  // ── Jobs ───────────────────────────────────────────────────────────

  Future<void> fetchJobs(String workspaceId) async {
    if (workspaceId.isEmpty) return;
    try {
      final raw = await _bridge.call<List<dynamic>>(
        "get_ingestion_jobs",
        {"workspace_id": workspaceId},
      );
      final fetched = raw.map((j) => IngestionJob.fromJson(j as Map<String, dynamic>)).toList();

      final otherWorkspaceJobs = state.jobs.where((j) => j.workspaceId != workspaceId).toList();
      final currentWorkspaceJobs = state.jobs.where((j) => j.workspaceId == workspaceId).toList();
      final merged = [...fetched];
      for (final local in currentWorkspaceJobs) {
        final isFetched = fetched.any((f) => f.id == local.id);
        if (!isFetched && local.isActive) merged.add(local);
      }
      final combined = [...otherWorkspaceJobs, ...merged];
      final active = combined.where((j) => j.isActive).cast<IngestionJob?>().firstWhere(
        (j) => true,
        orElse: () => null,
      );

      state = state.copyWith(
        jobs: combined,
        activeJob: active,
        lastJob: fetched.isNotEmpty ? fetched.first : null,
        error: null,
      );
    } catch (e) {
      state = state.copyWith(error: e.toString());
    }
  }

  /// Simplified stand-in for the TS store's self-rescheduling adaptive
  /// poll loop (see file doc comment) -- performs one immediate fetch.
  /// Wire up a real timer-based loop when the ingestion UI lands.
  Future<void> startPolling(String workspaceId) async {
    state = state.copyWith(isPolling: true);
    await fetchJobs(workspaceId);
    state = state.copyWith(isPolling: false);
  }

  void addLiveSource() => state = state.copyWith(liveSourceCount: state.liveSourceCount + 1);

  void removeLiveSource() =>
      state = state.copyWith(liveSourceCount: (state.liveSourceCount - 1).clamp(0, 1 << 30));

  void startIngestion(String sourceId) {
    state = state.copyWith(
      ingestingSourceIds: [
        ...state.ingestingSourceIds.where((id) => id != sourceId),
        sourceId,
      ],
    );
  }

  void stopIngestion(String sourceId) {
    state = state.copyWith(
      ingestingSourceIds: state.ingestingSourceIds.where((id) => id != sourceId).toList(),
    );
  }

  void addTransitioningSource(String sourceId) {
    state = state.copyWith(transitioningSourceIds: {...state.transitioningSourceIds, sourceId});
  }

  void removeTransitioningSource(String sourceId) {
    final next = Set<String>.from(state.transitioningSourceIds)..remove(sourceId);
    state = state.copyWith(transitioningSourceIds: next);
  }

  void clearTransitioningJobs() => state = state.copyWith(transitioningSourceIds: const {});

  void addOrUpdateJob(IngestionJob job) {
    final exists = state.jobs.any((j) => j.id == job.id);
    final nextJobs = exists
        ? [for (final j in state.jobs) if (j.id == job.id) job else j]
        : [job, ...state.jobs];
    final active = nextJobs.where((j) => j.isActive).cast<IngestionJob?>().firstWhere(
      (j) => true,
      orElse: () => null,
    );
    state = state.copyWith(jobs: nextJobs, activeJob: active, lastJob: nextJobs.first);
  }

  void clearCompletedState(String workspaceId, String sourceId) {
    final nextJobs = state.jobs
        .where(
          (j) => !(j.workspaceId == workspaceId &&
              j.sourceId == sourceId &&
              (j.status == "completed" || j.status == "failed")),
        )
        .toList();
    final active = nextJobs.where((j) => j.isActive).cast<IngestionJob?>().firstWhere(
      (j) => true,
      orElse: () => null,
    );
    state = state.copyWith(
      jobs: nextJobs,
      activeJob: active,
      lastJob: nextJobs.isNotEmpty ? nextJobs.first : null,
    );
  }

  void clearState() {
    final activeJobs = state.jobs.where((j) => j.isActive).toList();
    final active = activeJobs.isNotEmpty ? activeJobs.first : null;
    final activeSourceIds = activeJobs.map((j) => j.sourceId).toSet();
    state = state.copyWith(
      jobs: activeJobs,
      activeJob: active,
      lastJob: activeJobs.isNotEmpty ? activeJobs.first : null,
      error: null,
      ingestingSourceIds:
          state.ingestingSourceIds.where((id) => activeSourceIds.contains(id)).toList(),
    );
  }

  void removeJobsForSource(String sourceId) {
    final nextJobs = state.jobs.where((j) => j.sourceId != sourceId).toList();
    final active = nextJobs.where((j) => j.isActive).cast<IngestionJob?>().firstWhere(
      (j) => true,
      orElse: () => null,
    );
    state = state.copyWith(
      jobs: nextJobs,
      activeJob: active,
      lastJob: nextJobs.isNotEmpty ? nextJobs.first : null,
    );
  }

  void markJobHandled(int jobId) {
    state = state.copyWith(handledJobIds: {...state.handledJobIds, jobId});
  }

  bool isJobHandled(int jobId) => state.handledJobIds.contains(jobId);

  void clearHandledJobsForSource(String sourceId) {
    final sourceJobIds = state.jobs.where((j) => j.sourceId == sourceId).map((j) => j.id).toSet();
    final next = Set<int>.from(state.handledJobIds)..removeAll(sourceJobIds);
    state = state.copyWith(handledJobIds: next);
  }
}

final ingestionProvider = StateNotifierProvider<IngestionNotifier, IngestionState>((ref) {
  return IngestionNotifier(ref.watch(sidecarBridgeProvider));
});
