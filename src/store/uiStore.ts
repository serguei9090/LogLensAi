import { create } from "zustand";
import { persist } from "zustand/middleware";

// ─── Custom Column Definition ─────────────────────────────────────────────────

export interface CustomColumnDef {
  /** Unique key — also the facets key for auto columns, or a uuid for user columns */
  id: string;
  /** Display label in the table header */
  label: string;
  /** Column width CSS value */
  width: string;
  /** "auto" = extracted by backend into facets, "user" = frontend regex column */
  source: "auto" | "user";
  /** Regex pattern (capture group 1 = cell value). Only used for source==="user" */
  regex?: string;
}

// ─── Default built-in custom columns (auto-extracted by backend) ──────────────

const DEFAULT_CUSTOM_COLUMNS: CustomColumnDef[] = [
  { id: "http_method", label: "Method", width: "80px", source: "auto" },
  { id: "http_status", label: "Status", width: "72px", source: "auto" },
];

// ─── Store Interface ──────────────────────────────────────────────────────────

interface UIStore {
  sidebarCollapsed: boolean;
  facetSidebarCollapsed: boolean;
  columnManagerCollapsed: boolean;
  toggleSidebar: () => void;
  setSidebarCollapsed: (collapsed: boolean) => void;
  toggleFacetSidebar: () => void;
  setFacetSidebarCollapsed: (collapsed: boolean) => void;
  toggleColumnManager: () => void;
  setColumnManagerCollapsed: (collapsed: boolean) => void;
  visibleColumns: Record<string, boolean>;
  toggleColumnVisibility: (colName: string) => void;
  setColumnVisibility: (colName: string, visible: boolean) => void;
  customColumns: CustomColumnDef[];
  addCustomColumn: (col: CustomColumnDef) => void;
  removeCustomColumn: (id: string) => void;
}

// ─── Store ────────────────────────────────────────────────────────────────────

export const useUIStore = create<UIStore>()(
  persist(
    (set) => ({
      sidebarCollapsed: false,
      facetSidebarCollapsed: true,
      columnManagerCollapsed: true,
      toggleSidebar: () => set((state) => ({ sidebarCollapsed: !state.sidebarCollapsed })),
      setSidebarCollapsed: (collapsed) => set({ sidebarCollapsed: collapsed }),
      toggleFacetSidebar: () =>
        set((state) => {
          const next = !state.facetSidebarCollapsed;
          return {
            facetSidebarCollapsed: next,
            columnManagerCollapsed: next ? state.columnManagerCollapsed : true,
          };
        }),
      setFacetSidebarCollapsed: (collapsed) =>
        set((state) => ({
          facetSidebarCollapsed: collapsed,
          columnManagerCollapsed: collapsed ? state.columnManagerCollapsed : true,
        })),
      toggleColumnManager: () =>
        set((state) => {
          const next = !state.columnManagerCollapsed;
          return {
            columnManagerCollapsed: next,
            facetSidebarCollapsed: next ? state.facetSidebarCollapsed : true,
          };
        }),
      setColumnManagerCollapsed: (collapsed) =>
        set((state) => ({
          columnManagerCollapsed: collapsed,
          facetSidebarCollapsed: collapsed ? state.facetSidebarCollapsed : true,
        })),
      visibleColumns: {
        id: true,
        timestamp: true,
        ingest_timestamp: false,
        level: true,
        message: true,
        cluster_id: true,
        actions: true,
        // Auto custom columns default to hidden until user enables them
        http_method: false,
        http_status: false,
      },
      toggleColumnVisibility: (colName) =>
        set((state) => ({
          visibleColumns: {
            ...state.visibleColumns,
            [colName]: !state.visibleColumns[colName],
          },
        })),
      setColumnVisibility: (colName, visible) =>
        set((state) => ({
          visibleColumns: {
            ...state.visibleColumns,
            [colName]: visible,
          },
        })),
      customColumns: DEFAULT_CUSTOM_COLUMNS,
      addCustomColumn: (col) =>
        set((state) => ({
          customColumns: [...state.customColumns, col],
          visibleColumns: { ...state.visibleColumns, [col.id]: true },
        })),
      removeCustomColumn: (id) =>
        set((state) => {
          const { [id]: _removed, ...rest } = state.visibleColumns;
          return {
            customColumns: state.customColumns.filter((c) => c.id !== id),
            visibleColumns: rest,
          };
        }),
    }),
    {
      name: "loglensai-ui-state",
    },
  ),
);
