import { create } from "zustand";
import { persist } from "zustand/middleware";

interface UIStore {
  sidebarCollapsed: boolean;
  facetSidebarCollapsed: boolean;
  toggleSidebar: () => void;
  setSidebarCollapsed: (collapsed: boolean) => void;
  toggleFacetSidebar: () => void;
  setFacetSidebarCollapsed: (collapsed: boolean) => void;
  visibleColumns: Record<string, boolean>;
  toggleColumnVisibility: (colName: string) => void;
}

export const useUIStore = create<UIStore>()(
  persist(
    (set) => ({
      sidebarCollapsed: false,
      facetSidebarCollapsed: true,
      toggleSidebar: () => set((state) => ({ sidebarCollapsed: !state.sidebarCollapsed })),
      setSidebarCollapsed: (collapsed) => set({ sidebarCollapsed: collapsed }),
      toggleFacetSidebar: () =>
        set((state) => ({ facetSidebarCollapsed: !state.facetSidebarCollapsed })),
      setFacetSidebarCollapsed: (collapsed) => set({ facetSidebarCollapsed: collapsed }),
      visibleColumns: {
        id: true,
        timestamp: true,
        ingest_timestamp: false,
        level: true,
        message: true,
        cluster_id: true,
        actions: true,
      },
      toggleColumnVisibility: (colName) =>
        set((state) => ({
          visibleColumns: {
            ...state.visibleColumns,
            [colName]: !state.visibleColumns[colName],
          },
        })),
    }),
    {
      name: "loglensai-ui-state",
    },
  ),
);
