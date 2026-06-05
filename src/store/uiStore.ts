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
  columnOrder: string[];
  setColumnOrder: (order: string[]) => void;
  columnWidths: Record<string, string>;
  setColumnWidth: (id: string, width: string) => void;
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
        set((state) => {
          const idx = state.columnOrder.indexOf("message");
          const nextOrder = [...state.columnOrder];
          if (idx === -1) {
            nextOrder.push(col.id);
          } else {
            nextOrder.splice(idx, 0, col.id);
          }
          return {
            customColumns: [...state.customColumns, col],
            columnOrder: nextOrder,
            columnWidths: { ...state.columnWidths, [col.id]: col.width },
            visibleColumns: { ...state.visibleColumns, [col.id]: true },
          };
        }),
      removeCustomColumn: (id) =>
        set((state) => {
          const { [id]: _removed, ...rest } = state.visibleColumns;
          const { [id]: _widthRemoved, ...restWidths } = state.columnWidths;
          return {
            customColumns: state.customColumns.filter((c) => c.id !== id),
            columnOrder: state.columnOrder.filter((cId) => cId !== id),
            columnWidths: restWidths,
            visibleColumns: rest,
          };
        }),
      columnOrder: [
        "id",
        "timestamp",
        "ingest_timestamp",
        "level",
        "http_method",
        "http_status",
        "message",
        "cluster_id",
        "actions",
      ],
      setColumnOrder: (order) => set({ columnOrder: order }),
      columnWidths: {
        id: "80px",
        timestamp: "180px",
        ingest_timestamp: "180px",
        level: "90px",
        http_method: "80px",
        http_status: "72px",
        message: "1fr",
        cluster_id: "110px",
        actions: "100px",
      },
      setColumnWidth: (id, width) =>
        set((state) => ({
          columnWidths: { ...state.columnWidths, [id]: width },
        })),
    }),
    {
      name: "loglensai-ui-state",
    },
  ),
);
