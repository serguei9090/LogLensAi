import { create } from 'zustand';
import { callSidecar } from '../lib/hooks/useSidecarBridge';

export type ClusteringMode = 'auto' | 'manual' | 'burst';

interface ClusteringStatus {
  mode: ClusteringMode;
  running: boolean;
  backlog: number;
  processed_session: number;
}

interface ClusteringState {
  status: ClusteringStatus | null;
  isPolling: boolean;
  error: string | null;
  
  // Actions
  fetchStatus: (workspaceId?: string) => Promise<void>;
  setMode: (mode: ClusteringMode, workspaceId?: string) => Promise<void>;
  startPolling: (workspaceId?: string) => void;
  stopPolling: () => void;
}

let pollInterval: ReturnType<typeof setInterval> | null = null;

export const useClusteringStore = create<ClusteringState>((set, get) => ({
  status: null,
  isPolling: false,
  error: null,

  fetchStatus: async (workspaceId) => {
    try {
      const response = await callSidecar('get_clustering_status', { workspace_id: workspaceId });
      set({ status: response as ClusteringStatus, error: null });
    } catch (err: any) {
      set({ error: err.message || 'Failed to fetch clustering status' });
      console.error('Clustering store fetch error:', err);
    }
  },

  setMode: async (mode, workspaceId) => {
    try {
      await callSidecar('set_clustering_mode', { mode, workspace_id: workspaceId });
      // Proactively update local state
      const currentStatus = get().status;
      if (currentStatus) {
        set({ status: { ...currentStatus, mode } });
      }
      // Re-fetch to confirm
      await get().fetchStatus(workspaceId);
    } catch (err: any) {
      set({ error: err.message || 'Failed to set clustering mode' });
    }
  },

  startPolling: (workspaceId) => {
    if (get().isPolling) return;
    
    set({ isPolling: true });
    get().fetchStatus(workspaceId); // Initial fetch
    
    pollInterval = setInterval(() => {
      get().fetchStatus(workspaceId);
    }, 2000); // Poll every 2 seconds
  },

  stopPolling: () => {
    if (pollInterval) {
      clearInterval(pollInterval);
      pollInterval = null;
    }
    set({ isPolling: false });
  },
}));
