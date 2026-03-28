import type { FilterEntry } from "@/components/molecules/FilterBuilder";
import type { HighlightEntry } from "@/components/molecules/HighlightBuilder";
import type { LogEntry } from "@/components/organisms/VirtualLogTable";
import { create } from "zustand";

export interface InvestigationStore {
  searchQuery: string;
  filters: FilterEntry[];
  highlights: HighlightEntry[];
  logs: LogEntry[];
  total: number;
  offset: number;
  isTailing: boolean;
  sortBy: string;
  sortOrder: "asc" | "desc";
  setSearchQuery: (q: string) => void;
  setFilters: (f: FilterEntry[]) => void;
  setHighlights: (h: HighlightEntry[]) => void;
  setLogs: (logs: LogEntry[], total: number) => void;
  updateLog: (id: number, updates: Partial<LogEntry>) => void;
  setTailing: (v: boolean) => void;
  setSort: (by: string, order: "asc" | "desc") => void;
}

export const useInvestigationStore = create<InvestigationStore>((set) => ({
  searchQuery: "",
  filters: [],
  highlights: [],
  logs: [],
  total: 0,
  offset: 0,
  isTailing: false,
  sortBy: "timestamp",
  sortOrder: "desc",
  setSearchQuery: (searchQuery) => set({ searchQuery }),
  setFilters: (filters) => set({ filters }),
  setHighlights: (highlights) => set({ highlights }),
  setLogs: (logs, total) => set({ logs, total }),
  updateLog: (id, updates) =>
    set((state) => ({
      logs: state.logs.map((l) => (l.id === id ? { ...l, ...updates } : l)),
    })),
  setTailing: (isTailing) => set({ isTailing }),
  setSort: (sortBy, sortOrder) => set({ sortBy, sortOrder }),
}));

