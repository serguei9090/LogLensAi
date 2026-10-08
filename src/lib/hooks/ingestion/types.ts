import type { LogSource } from "@/store/workspaceStore";

export interface LogIngestionHookResult {
  tailingSourceIds: Set<string>;
  setTailingSourceIds: React.Dispatch<React.SetStateAction<Set<string>>>;
  handleImportLocal: (path: string, tail: boolean, folderId?: string | null) => Promise<void>;
  duplicateSource: (source: LogSource) => Promise<void>;
  handleStopTail: (sourceId: string, filepath: string) => Promise<void>;
  handleImportSSH: (
    host: string,
    port: number,
    user: string,
    pass: string,
    path: string,
    tail: boolean,
    folderId?: string | null,
  ) => Promise<void>;
  handleIngestManual: (rawText: string, folderId?: string | null) => Promise<void>;
  handleImportLive: (
    name: string,
    types: { syslog: boolean; http: boolean },
    folderId?: string | null,
  ) => Promise<void>;
}
