import { create } from "zustand";
import type { FilterEntry } from "@/components/molecules/FilterBuilder";
import type { HighlightEntry } from "@/components/molecules/HighlightBuilder";
import type { LogEntry } from "@/components/organisms/VirtualLogTable";

export interface SourceState {
  searchQuery: string;
  filters: FilterEntry[];
  highlights: HighlightEntry[];
  logs: LogEntry[];
  total: number;
  offset: number;
  sortBy: string;
  sortOrder: "asc" | "desc";
  timeRange: { start: string; end: string; label?: string };
  selectedLogIds: number[];
  availableFacets: Record<string, { value: string; count: number }[]>;
}

export interface InvestigationStore extends SourceState {
  isTailing: boolean;
  showDistribution: boolean;
  showAnomalies: boolean;
  workspaceGlobalContext: string | null;
  /** The currently active source ID or 'aggregate' for the All view */
  currentSourceId: string;
  /** Persisted map of states for each source encountered in this session */
  sourceStates: Record<string, SourceState>;

  /**
   * Swaps the active state for another source's state.
   * Saves existing active state into the map before switching.
   */
  syncActiveSource: (sourceId: string | null) => void;

  setSearchQuery: (q: string) => void;
  setFilters: (f: FilterEntry[]) => void;
  setHighlights: (h: HighlightEntry[]) => void;
  setLogs: (logs: LogEntry[], total: number) => void;
  updateLog: (id: number, updates: Partial<LogEntry>) => void;
  setTailing: (v: boolean) => void;
  setSort: (by: string, order: "asc" | "desc") => void;
  setShowDistribution: (v: boolean) => void;
  setShowAnomalies: (v: boolean) => void;
  setWorkspaceGlobalContext: (v: string | null) => void;
  setTimeRange: (range: { start: string; end: string; label?: string }) => void;
  setSelectedLogIds: (ids: number[]) => void;
  toggleLogSelection: (id: number) => void;
  clearSelection: () => void;
  setAvailableFacets: (facets: Record<string, { value: string; count: number }[]>) => void;
}

const DEFAULT_SOURCE_STATE: SourceState = {
  searchQuery: "",
  filters: [],
  highlights: [],
  logs: [],
  total: 0,
  offset: 0,
  sortBy: "timestamp",
  sortOrder: "desc",
  timeRange: { start: "", end: "" },
  selectedLogIds: [],
  availableFacets: {},
};

export const useInvestigationStore = create<InvestigationStore>((set, get) => ({
  ...DEFAULT_SOURCE_STATE,
  isTailing: false,
  showDistribution: false,
  showAnomalies: false,
  workspaceGlobalContext: null,
  currentSourceId: "aggregate",
  sourceStates: {},

  syncActiveSource: (sourceId = null) => {
    const nextId = sourceId ?? "aggregate";
    const { currentSourceId, sourceStates } = get();
    if (nextId === currentSourceId) {
      return;
    }

    // 1. Capture current values into a SourceState snapshot
    const currentSnapshot: SourceState = {
      searchQuery: get().searchQuery,
      filters: get().filters,
      highlights: get().highlights,
      logs: get().logs,
      total: get().total,
      offset: get().offset,
      sortBy: get().sortBy,
      sortOrder: get().sortOrder,
      timeRange: get().timeRange,
      selectedLogIds: get().selectedLogIds,
      availableFacets: get().availableFacets,
    };

    // 2. Update the sourceStates map
    const updatedMap = {
      ...sourceStates,
      [currentSourceId]: currentSnapshot,
    };

    // 3. Load next state (or defaults if new source)
    const nextState = updatedMap[nextId] || DEFAULT_SOURCE_STATE;

    set({
      ...nextState,
      currentSourceId: nextId,
      sourceStates: updatedMap,
    });
  },

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
  setShowDistribution: (showDistribution) => set({ showDistribution }),
  setShowAnomalies: (showAnomalies) => set({ showAnomalies }),
  setWorkspaceGlobalContext: (workspaceGlobalContext) => set({ workspaceGlobalContext }),
  setTimeRange: (timeRange) => set({ timeRange }),
  setSelectedLogIds: (selectedLogIds) => set({ selectedLogIds }),
  toggleLogSelection: (id) =>
    set((state) => ({
      selectedLogIds: state.selectedLogIds.includes(id)
        ? state.selectedLogIds.filter((x) => x !== id)
        : [...state.selectedLogIds, id],
    })),
  clearSelection: () => set({ selectedLogIds: [] }),
  setAvailableFacets: (availableFacets) => set({ availableFacets }),
}));
