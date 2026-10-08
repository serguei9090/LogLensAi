export interface IngestionJob {
  id: number;
  workspace_id: string;
  source_id: string;
  status: "queued" | "pending" | "processing" | "completed" | "failed";
  total_lines: number;
  processed_lines: number;
  /** 1-based position in the active queue. 0 = not queued (completed/failed). */
  queue_position: number;
  created_at: string;
  updated_at: string;
}

export interface WorkspacePollSession {
  sessionId: number;
  timer: ReturnType<typeof setTimeout> | null;
}

export interface ImportModalState {
  isImportOpen: boolean;
  isImportProcessing: boolean;
  importActiveTab: "local" | "ssh" | "manual" | "live";
  importLocalPath: string;
  importLocalTail: boolean;
  importSshHost: string;
  importSshPort: string;
  importSshUser: string;
  importSshPass: string;
  importSshPath: string;
  importSshTail: boolean;
  importManualLogs: string;
  importLiveName: string;
  importLiveSyslog: boolean;
  importLiveHttp: boolean;
}

export interface ImportModalActions {
  setImportOpen: (open: boolean) => void;
  setImportProcessing: (processing: boolean) => void;
  setImportActiveTab: (tab: "local" | "ssh" | "manual" | "live") => void;
  setImportLocalPath: (path: string) => void;
  setImportLocalTail: (tail: boolean) => void;
  setImportSshHost: (host: string) => void;
  setImportSshPort: (port: string) => void;
  setImportSshUser: (user: string) => void;
  setImportSshPass: (pass: string) => void;
  setImportSshPath: (path: string) => void;
  setImportSshTail: (tail: boolean) => void;
  setImportManualLogs: (logs: string) => void;
  setImportLiveName: (name: string) => void;
  setImportLiveSyslog: (syslog: boolean) => void;
  setImportLiveHttp: (http: boolean) => void;
  resetImportForm: () => void;
}

export interface TrackingState {
  error: string | null;
  /** Tracks sources that are currently ingesting or finalizing logs. */
  ingestingSourceIds: string[];
  /**
   * Per-source IDs that are transitioning (between callSidecar returning and
   * the first poll detecting a job).
   */
  transitioningSourceIds: Set<string>;
  /** Tracks job IDs that have already triggered a completed/failed notification. */
  notifiedJobIds: Set<number>;
  /** Tracks job IDs whose completion has already been fully handled. */
  handledJobIds: Set<number>;
  /** Tracks sources whose job just completed but fetchLogs hasn't returned data yet. */
  retrievingSourceIds: Set<string>;
}

export interface TrackingActions {
  startIngestion: (sourceId: string) => void;
  stopIngestion: (sourceId: string) => void;
  addTransitioningSource: (sourceId: string) => void;
  removeTransitioningSource: (sourceId: string) => void;
  clearTransitioningJobs: () => void;
  markJobHandled: (jobId: number) => void;
  isJobHandled: (jobId: number) => boolean;
  clearHandledJobsForSource: (sourceId: string) => void;
}

export interface PollingState {
  jobs: IngestionJob[];
  activeJob: IngestionJob | null;
  lastJob: IngestionJob | null;
  isPolling: boolean;
  /** Count of active live sources (tails, SSH streams, syslog/HTTP listeners). */
  liveSourceCount: number;
}

export interface PollingActions {
  fetchJobs: (workspaceId: string) => Promise<void>;
  startPolling: (workspaceId: string) => void;
  addLiveSource: () => void;
  removeLiveSource: () => void;
  addOrUpdateJob: (job: IngestionJob) => void;
  clearCompletedState: (workspaceId: string, sourceId: string) => void;
  clearState: () => void;
  removeJobsForSource: (sourceId: string) => void;
}

export type IngestionStore = ImportModalState &
  ImportModalActions &
  TrackingState &
  TrackingActions &
  PollingState &
  PollingActions;
