import { create } from "zustand";
import { persist } from "zustand/middleware";

// ─── Domain Types ─────────────────────────────────────────────────────────────

/** A single ingestion source attached to a workspace (local file, SSH path, manual paste, or fusion orchestration). */
export interface LogSource {
  /** Unique stable ID for this source within the workspace */
  id: string;
  /** Human-readable display label (defaults to basename of path) */
  name: string;
  /** Transport type – determines which RPC methods are used for tailing.
   *  'fusion' sources are orchestrated virtual streams managed by OrchestratorHub.
   */
  type: "local" | "ssh" | "manual" | "fusion" | "live";
  /** Absolute file path, SSH connection string, or fusion ID for type='fusion' */
  /** Absolute file path, SSH connection string, or fusion ID for type='fusion' */
  path: string;
}

export interface Folder {
  id: string;
  name: string;
  parentId: string | null;
}

export interface HierarchyNode {
  id: string;
  name: string;
  type: "folder";
  children: HierarchyNode[];
  sources: LogSource[];
}

/** A workspace is a named investigation session with one or more log sources. */
export interface Workspace {
  id: string;
  name: string;
  /** Flattened list of sources for active selection and tab-like behavior if needed */
  sources: LogSource[];
  /** Tree-based hierarchy for explorer sidebar */
  hierarchy?: HierarchyNode;
  /** ID of the currently-visible source tab; null → show all logs (aggregate view) */
  activeSourceId: string | null;
  /** ID of the currently-selected folder for explorer view; null → workspace root */
  activeFolderId: string | null;
  createdAt: string; // ISO string for safe serialization
}

// ─── Store Interface ───────────────────────────────────────────────────────────

interface WorkspaceStore {
  workspaces: Workspace[];
  activeWorkspaceId: string;
  isHierarchyLoading: boolean;
  setActive: (id: string) => void;
  addWorkspace: (ws: Pick<Workspace, "id" | "name">) => void;
  removeWorkspace: (id: string) => void;
  renameWorkspace: (id: string, name: string) => void;
  /** Add a new LogSource to a workspace and switch to it */
  createSource: (
    workspaceId: string,
    source: Omit<LogSource, "id">,
    folderId?: string | null,
  ) => Promise<LogSource>;
  /** Remove a source from a workspace by its id; selects the previous tab */
  removeSource: (workspaceId: string, sourceId: string) => void;
  /** Switch the active source tab inside a workspace */
  setActiveSource: (workspaceId: string, sourceId: string | null) => void;
  /** Rename a source tab */
  renameSource: (workspaceId: string, sourceId: string, name: string) => void;
  /** Update any field in a LogSource object */
  updateSource: (workspaceId: string, sourceId: string, updates: Partial<LogSource>) => void;
  /** Switch the active folder inside a workspace (for explorer view) */
  setActiveFolder: (workspaceId: string, folderId: string | null) => void;

  // Hierarchy actions
  fetchHierarchy: (workspaceId: string) => Promise<void>;
  createFolder: (workspaceId: string, name: string, parentId?: string) => Promise<void>;
  updateFolder: (folderId: string, name?: string, parentId?: string) => Promise<void>;
  deleteFolder: (folderId: string) => Promise<void>;
  moveSource: (sourceId: string, folderId: string | null) => Promise<void>;

  /** Reset store to empty state */
  reset: () => void;
}

// ─── Helper ────────────────────────────────────────────────────────────────────

/** Generates a short, collision-resistant ID without external deps */
function uid() {
  return `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 7)}`;
}

// ─── Store ────────────────────────────────────────────────────────────────────

export const useWorkspaceStore = create<WorkspaceStore>()(
  persist(
    (set) => ({
      workspaces: [],
      activeWorkspaceId: "",
      isHierarchyLoading: false,

      setActive: (id) => set({ activeWorkspaceId: id }),

      addWorkspace: (ws) =>
        set((state) => {
          // Guard: prevent adding duplicate IDs
          if (state.workspaces.some((w) => w.id === ws.id)) {
            return state;
          }
          const newWs: Workspace = {
            ...ws,
            sources: [],
            activeSourceId: null,
            activeFolderId: null,
            createdAt: new Date().toISOString(),
          };
          return {
            workspaces: [...state.workspaces, newWs],
            // Auto-select only when nothing is currently active
            activeWorkspaceId: state.activeWorkspaceId || ws.id,
          };
        }),

      removeWorkspace: (id) =>
        set((state) => {
          const remaining = state.workspaces.filter((w) => w.id !== id);
          return {
            workspaces: remaining,
            activeWorkspaceId:
              state.activeWorkspaceId === id ? (remaining[0]?.id ?? "") : state.activeWorkspaceId,
          };
        }),

      renameWorkspace: (id, name) =>
        set((state) => ({
          workspaces: state.workspaces.map((w) => (w.id === id ? { ...w, name } : w)),
        })),

      createSource: async (workspaceId, sourceData, folderId) => {
        set({ isHierarchyLoading: true });
        try {
          const { callSidecar } = await import("../lib/hooks/useSidecarBridge");
          const res = await callSidecar<{ source_id: string }>("create_log_source", {
            workspace_id: workspaceId,
            name: sourceData.name,
            type: sourceData.type,
            path: sourceData.path,
            folder_id: folderId,
          });

          const newSource: LogSource = { id: res.source_id, ...sourceData };

          set((state) => ({
            workspaces: state.workspaces.map((w) => {
              if (w.id !== workspaceId) {
                return w;
              }
              return {
                ...w,
                sources: [...w.sources, newSource],
                activeSourceId: w.activeSourceId ?? newSource.id,
              };
            }),
          }));

          // Refresh hierarchy to show the new source in the tree
          const get = useWorkspaceStore.getState as any;
          await get().fetchHierarchy(workspaceId);

          return newSource;
        } finally {
          set({ isHierarchyLoading: false });
        }
      },

      removeSource: async (workspaceId, sourceId) => {
        set({ isHierarchyLoading: true });
        try {
          const { callSidecar } = await import("../lib/hooks/useSidecarBridge");
          await callSidecar("delete_log_source", { source_id: sourceId });

          set((state) => ({
            workspaces: state.workspaces.map((w) => {
              if (w.id !== workspaceId) {
                return w;
              }
              const remaining = w.sources.filter((s) => s.id !== sourceId);
              const wasActive = w.activeSourceId === sourceId;
              return {
                ...w,
                sources: remaining,
                // Fall back to first remaining source or null (aggregate)
                activeSourceId: wasActive ? (remaining[0]?.id ?? null) : w.activeSourceId,
              };
            }),
          }));

          // Refresh hierarchy
          const get = useWorkspaceStore.getState as any;
          await get().fetchHierarchy(workspaceId);
        } finally {
          set({ isHierarchyLoading: false });
        }
      },

      setActiveSource: (workspaceId, sourceId) =>
        set((state) => ({
          workspaces: state.workspaces.map((ws) =>
            ws.id === workspaceId ? { ...ws, activeSourceId: sourceId, activeFolderId: null } : ws,
          ),
        })),

      renameSource: async (workspaceId, sourceId, name) => {
        set({ isHierarchyLoading: true });
        try {
          const { callSidecar } = await import("../lib/hooks/useSidecarBridge");
          await callSidecar("update_log_source", { source_id: sourceId, name });

          set((state) => ({
            workspaces: state.workspaces.map((w) => {
              if (w.id !== workspaceId) {
                return w;
              }
              return {
                ...w,
                sources: w.sources.map((s) => (s.id === sourceId ? { ...s, name } : s)),
              };
            }),
          }));

          // Refresh hierarchy
          const get = useWorkspaceStore.getState as any;
          await get().fetchHierarchy(workspaceId);
        } finally {
          set({ isHierarchyLoading: false });
        }
      },

      updateSource: (workspaceId, sourceId, updates) =>
        set((state) => ({
          workspaces: state.workspaces.map((ws) =>
            ws.id === workspaceId
              ? {
                  ...ws,
                  sources: ws.sources.map((s) => (s.id === sourceId ? { ...s, ...updates } : s)),
                }
              : ws,
          ),
        })),

      setActiveFolder: (workspaceId, folderId) =>
        set((state) => ({
          workspaces: state.workspaces.map((ws) =>
            ws.id === workspaceId ? { ...ws, activeFolderId: folderId, activeSourceId: null } : ws,
          ),
        })),

      fetchHierarchy: async (workspaceId) => {
        set({ isHierarchyLoading: true });
        try {
          const { callSidecar } = await import("../lib/hooks/useSidecarBridge");
          const res = await callSidecar<{ workspace_id: string; root: HierarchyNode }>(
            "get_hierarchy",
            {
              workspace_id: workspaceId,
            },
          );
          if (res) {
            set((state) => ({
              workspaces: state.workspaces.map((w) =>
                w.id === workspaceId ? { ...w, hierarchy: res.root } : w,
              ),
            }));
          }
        } finally {
          set({ isHierarchyLoading: false });
        }
      },

      createFolder: async (workspaceId, name, parentId) => {
        set({ isHierarchyLoading: true });
        try {
          const { callSidecar } = await import("../lib/hooks/useSidecarBridge");
          await callSidecar("create_folder", {
            workspace_id: workspaceId,
            name,
            parent_id: parentId,
          });
          const get = useWorkspaceStore.getState as any;
          await get().fetchHierarchy(workspaceId);
        } finally {
          set({ isHierarchyLoading: false });
        }
      },

      updateFolder: async (folderId, name, parentId) => {
        set({ isHierarchyLoading: true });
        try {
          const { callSidecar } = await import("../lib/hooks/useSidecarBridge");
          await callSidecar("update_folder", { folder_id: folderId, name, parent_id: parentId });
          const state = (useWorkspaceStore.getState as any)();
          if (state.activeWorkspaceId) {
            await state.fetchHierarchy(state.activeWorkspaceId);
          }
        } finally {
          set({ isHierarchyLoading: false });
        }
      },

      deleteFolder: async (folderId) => {
        set({ isHierarchyLoading: true });
        try {
          const { callSidecar } = await import("../lib/hooks/useSidecarBridge");
          await callSidecar("delete_folder", { folder_id: folderId });
          const state = (useWorkspaceStore.getState as any)();
          if (state.activeWorkspaceId) {
            await state.fetchHierarchy(state.activeWorkspaceId);
          }
        } finally {
          set({ isHierarchyLoading: false });
        }
      },

      moveSource: async (sourceId, folderId) => {
        set({ isHierarchyLoading: true });
        try {
          const { callSidecar } = await import("../lib/hooks/useSidecarBridge");
          await callSidecar("move_source", { source_id: sourceId, folder_id: folderId });
          const state = (useWorkspaceStore.getState as any)();
          if (state.activeWorkspaceId) {
            await state.fetchHierarchy(state.activeWorkspaceId);
          }
        } finally {
          set({ isHierarchyLoading: false });
        }
      },

      reset: () => set({ workspaces: [], activeWorkspaceId: "" }),
    }),

    {
      name: "loglensai-workspaces-v4",
    },
  ),
);

// ─── Derived Selectors ────────────────────────────────────────────────────────

/** Returns the currently active Workspace object or undefined */
export const selectActiveWorkspace = (state: WorkspaceStore) =>
  state.workspaces.find((w) => w.id === state.activeWorkspaceId);

/** Returns the active LogSource inside the active workspace, or null for aggregate view */
export const selectActiveSource = (state: WorkspaceStore): LogSource | null => {
  const ws = selectActiveWorkspace(state);
  if (!ws || ws.activeSourceId === null) {
    return null;
  }
  return ws.sources.find((s) => s.id === ws.activeSourceId) ?? null;
};
