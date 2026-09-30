import { create } from "zustand";

export interface DebugLog {
  id: string;
  timestamp: string;
  level: "info" | "warn" | "error" | "debug";
  source: "frontend" | "tauri" | "sidecar" | "system";
  message: string;
  data?: any;
}

interface DebugStore {
  logs: DebugLog[];
  isOpen: boolean;
  setOpen: (open: boolean) => void;
  addLog: (log: Omit<DebugLog, "id" | "timestamp">) => void;
  clearLogs: () => void;
}

const MAX_LOGS = 500;

export const useDebugStore = create<DebugStore>((set) => ({
  logs: [],
  isOpen: false,
  setOpen: (isOpen) => set({ isOpen }),
  addLog: (log) =>
    set((state) => {
      const newLog: DebugLog = {
        ...log,
        id: Math.random().toString(36).substring(7),
        timestamp: new Date().toLocaleTimeString(),
      };
      // Keep logs in reverse chronological order for easy viewing
      const updatedLogs = [newLog, ...state.logs].slice(0, MAX_LOGS);
      return { logs: updatedLogs };
    }),
  clearLogs: () => set({ logs: [] }),
}));
