import type { AppSettings } from "@/store/settingsStore";
import type { FolderOpen } from "lucide-react";

export interface ImportFeedModalProps {
  readonly onImportLocal: (path: string, tail: boolean) => void;
  readonly onImportSSH: (
    host: string,
    port: number,
    user: string,
    pass: string,
    path: string,
    tail: boolean,
  ) => void;
  readonly onIngestManual: (logs: string) => void;
  readonly onImportLive: (name: string, types: { syslog: boolean; http: boolean }) => void;
}

export type TabId = "local" | "ssh" | "manual" | "live";

export interface TabOption {
  readonly id: TabId;
  readonly icon: typeof FolderOpen;
  readonly label: string;
}

export interface LocalTabProps {
  readonly localPath: string;
  readonly localTail: boolean;
  readonly isDragOver: boolean;
  readonly setLocalPath: (val: string) => void;
  readonly setLocalTail: (val: boolean) => void;
  readonly onImportLocal: (path: string, tail: boolean) => void;
  readonly handleDragOver: (e: React.DragEvent) => void;
  readonly handleDragLeave: () => void;
  readonly handleDrop: (e: React.DragEvent) => void;
  readonly handleBrowse: () => void;
}

export interface SshTabProps {
  readonly sshHost: string;
  readonly setSshHost: (val: string) => void;
  readonly sshPort: string;
  readonly setSshPort: (val: string) => void;
  readonly sshUser: string;
  readonly setSshUser: (val: string) => void;
  readonly sshPass: string;
  readonly setSshPass: (val: string) => void;
  readonly sshPath: string;
  readonly setSshPath: (val: string) => void;
  readonly sshTail: boolean;
  readonly setSshTail: (val: boolean) => void;
  readonly onImportSSH: (
    host: string,
    port: number,
    user: string,
    pass: string,
    path: string,
    tail: boolean,
  ) => void;
}

export interface ManualTabProps {
  readonly manualLogs: string;
  readonly setManualLogs: (val: string) => void;
  readonly onIngestManual: (logs: string) => void;
}

export interface LiveTabProps {
  readonly liveName: string;
  readonly setLiveName: (val: string) => void;
  readonly liveSyslog: boolean;
  readonly setLiveSyslog: (val: boolean) => void;
  readonly liveHttp: boolean;
  readonly setLiveHttp: (val: boolean) => void;
  readonly onImportLive: (name: string, types: { syslog: boolean; http: boolean }) => void;
  readonly settings: AppSettings;
  readonly activeWorkspaceId: string | null;
}
