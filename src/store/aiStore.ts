import { create } from "zustand";
import { callSidecar } from "@/lib/hooks/useSidecarBridge";

export interface AiMessage {
  id: number;
  session_id: string;
  role: "user" | "assistant" | "system";
  content: string;
  context_logs?: number[];
  timestamp: string;
}

export interface AiSession {
  session_id: string;
  name: string;
  created_at: string;
  last_modified: string;
}

interface AiStore {
  currentSessionId: string | null;
  sessions: AiSession[];
  messages: AiMessage[];
  isLoading: boolean;
  isSidebarOpen: boolean;
  sidebarWidth: number;
  error: string | null;
  logSessionMap: Record<number, string>; // log_id -> session_id

  // Actions
  setSidebarOpen: (open: boolean) => void;
  setSidebarWidth: (width: number) => void;
  setSession: (sessionId: string | null) => void;
  fetchSessions: (workspaceId: string) => Promise<void>;
  fetchMessages: (sessionId: string) => Promise<void>;
  fetchMapping: (workspaceId: string) => Promise<void>;
  renameSession: (sessionId: string, name: string, workspaceId: string) => Promise<void>;
  deleteSession: (sessionId: string, workspaceId: string) => Promise<void>;
  sendMessage: (params: {
    workspace_id: string;
    message: string;
    context_logs?: number[];
    model?: string;
    session_name?: string;
  }) => Promise<void>;
  clearError: () => void;
}

export const useAiStore = create<AiStore>((set, get) => ({
  currentSessionId: null,
  sessions: [],
  messages: [],
  isLoading: false,
  isSidebarOpen: false,
  sidebarWidth: 450,
  error: null,
  logSessionMap: {},

  setSidebarOpen: (isSidebarOpen) => set({ isSidebarOpen }),
  setSidebarWidth: (sidebarWidth) => set({ sidebarWidth }),

  setSession: (sessionId) => {
    set({ currentSessionId: sessionId });
    if (sessionId) {
      get().fetchMessages(sessionId);
    } else {
      set({ messages: [] });
    }
  },

  fetchSessions: async (workspaceId) => {
    try {
      const sessions = await callSidecar<AiSession[]>({
        method: "get_ai_sessions",
        params: { workspace_id: workspaceId },
      });
      set({ sessions });
    } catch (err) {
      set({ error: (err as Error).message });
    }
  },

  fetchMapping: async (workspaceId) => {
    try {
      const logSessionMap = await callSidecar<Record<number, string>>({
        method: "get_ai_mapping",
        params: { workspace_id: workspaceId },
      });
      set({ logSessionMap });
    } catch (err) {
      console.error("Failed to fetch AI mappings:", err);
    }
  },

  renameSession: async (sessionId, name, workspaceId) => {
    try {
      await callSidecar({
        method: "rename_ai_session",
        params: { session_id: sessionId, name },
      });
      await get().fetchSessions(workspaceId);
    } catch (err) {
      set({ error: (err as Error).message });
    }
  },

  deleteSession: async (sessionId, workspaceId) => {
    try {
      await callSidecar({
        method: "delete_ai_session",
        params: { session_id: sessionId },
      });
      if (get().currentSessionId === sessionId) {
        set({ currentSessionId: null, messages: [] });
      }
      await get().fetchSessions(workspaceId);
      await get().fetchMapping(workspaceId);
    } catch (err) {
      set({ error: (err as Error).message });
    }
  },

  fetchMessages: async (sessionId) => {
    set({ isLoading: true });
    try {
      const messages = await callSidecar<AiMessage[]>({
        method: "get_ai_messages",
        params: { session_id: sessionId },
      });
      set({ messages, isLoading: false });
    } catch (err) {
      set({ error: (err as Error).message, isLoading: false });
    }
  },

  sendMessage: async (params) => {
    const { currentSessionId } = get();
    set({ isLoading: true, error: null });

    const tempUserMsg: AiMessage = {
      id: Date.now(),
      session_id: currentSessionId || "temp",
      role: "user",
      content: params.message,
      context_logs: params.context_logs,
      timestamp: new Date().toISOString(),
    };

    set((state) => ({ 
      messages: [...state.messages, tempUserMsg] 
    }));

    try {
      const result = await callSidecar<{ session_id: string; response: string }>({
        method: "send_ai_message",
        params: {
          ...params,
          session_id: currentSessionId,
        },
      });

      if (!currentSessionId) {
        set({ currentSessionId: result.session_id });
        await get().fetchSessions(params.workspace_id);
      }

      await get().fetchMapping(params.workspace_id);
      await get().fetchMessages(result.session_id);
    } catch (err) {
      set({ error: (err as Error).message, isLoading: false });
    }
  },

  clearError: () => set({ error: null }),
}));
