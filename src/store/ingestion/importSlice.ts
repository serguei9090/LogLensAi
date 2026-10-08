import type { StateCreator } from "zustand";
import type { ImportModalActions, ImportModalState, IngestionStore } from "./types";

export const initialImportModalState: ImportModalState = {
  isImportOpen: false,
  isImportProcessing: false,
  importActiveTab: "local",
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
};

export const createImportSlice: StateCreator<
  IngestionStore,
  [],
  [],
  ImportModalState & ImportModalActions
> = (set) => ({
  ...initialImportModalState,

  setImportOpen: (open) => set({ isImportOpen: open }),
  setImportProcessing: (processing) => set({ isImportProcessing: processing }),
  setImportActiveTab: (tab) => set({ importActiveTab: tab }),
  setImportLocalPath: (path) => set({ importLocalPath: path }),
  setImportLocalTail: (tail) => set({ importLocalTail: tail }),
  setImportSshHost: (host) => set({ importSshHost: host }),
  setImportSshPort: (port) => set({ importSshPort: port }),
  setImportSshUser: (user) => set({ importSshUser: user }),
  setImportSshPass: (pass) => set({ importSshPass: pass }),
  setImportSshPath: (path) => set({ importSshPath: path }),
  setImportSshTail: (tail) => set({ importSshTail: tail }),
  setImportManualLogs: (logs) => set({ importManualLogs: logs }),
  setImportLiveName: (name) => set({ importLiveName: name }),
  setImportLiveSyslog: (syslog) => set({ importLiveSyslog: syslog }),
  setImportLiveHttp: (http) => set({ importLiveHttp: http }),
  resetImportForm: () =>
    set({
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
    }),
});
