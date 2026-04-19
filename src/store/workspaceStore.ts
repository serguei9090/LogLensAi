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
  type: "local" | "ssh" | "manual" | "fusion";
  /** Absolute file path, SSH connection string, or fusion ID for type='fusion' */
  path: string;
}

/** A workspace is a named investigation session with one or more log sources. */
export interface Workspace {
  id: string;
  name: string;
  /** Ordered list of sources attached to this workspace */
  sources: LogSource[];
  /** ID of the currently-visible source tab; null → show all logs (aggregate view) */
  activeSourceId: string | null;
  createdAt: string; // ISO string for safe serialization
}

// ─── Store Interface ───────────────────────────────────────────────────────────

interface WorkspaceStore {
  workspaces: Workspace[];
  activeWorkspaceId: string;
  setActive: (id: string) => void;
  addWorkspace: (ws: Pick<Workspace, "id" | "name">) => void;
  removeWorkspace: (id: string) => void;
  renameWorkspace: (id: string, name: string) => void;
  /** Add a new LogSource to a workspace and switch to it */
  addSource: (workspaceId: string, source: Omit<LogSource, "id">) => LogSource;
  /** Remove a source from a workspace by its id; selects the previous tab */
  removeSource: (workspaceId: string, sourceId: string) => void;
  /** Switch the active source tab inside a workspace */
  setActiveSource: (workspaceId: string, sourceId: string | null) => void;
  /** Rename a source tab */
  renameSource: (workspaceId: string, sourceId: string, name: string) => void;
  /** Update any field in a LogSource object */
  updateSource: (workspaceId: string, sourceId: string, updates: Partial<LogSource>) => void;
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

      addSource: (workspaceId, sourceData) => {
        const newSource: LogSource = { id: uid(), ...sourceData };
        set((state) => ({
          workspaces: state.workspaces.map((w) => {
            if (w.id !== workspaceId) {
              return w;
            }
            return {
              ...w,
              sources: [...w.sources, newSource],
              // Auto-activate the first source added; subsequent ones stay on current tab
              activeSourceId: w.activeSourceId ?? newSource.id,
            };
          }),
        }));
        return newSource;
      },

      removeSource: (workspaceId, sourceId) =>
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
        })),

      setActiveSource: (workspaceId, sourceId) =>
        set((state) => ({
          workspaces: state.workspaces.map((w) =>
            w.id === workspaceId ? { ...w, activeSourceId: sourceId } : w,
          ),
        })),

      renameSource: (workspaceId: string, sourceId: string, name: string) =>
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
        })),

      updateSource: (workspaceId, sourceId, updates) =>
        set((state) => ({
          workspaces: state.workspaces.map((w) => {
            if (w.id !== workspaceId) {
              return w;
            }
            return {
              ...w,
              sources: w.sources.map((s) => (s.id === sourceId ? { ...s, ...updates } : s)),
            };
          }),
        })),
      }),

    {
      name: "loglensai-workspaces-v3",
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
