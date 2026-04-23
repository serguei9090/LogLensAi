import { SIDECAR_BASE_URL, callSidecar } from "@/lib/hooks/useSidecarBridge";
import { toast } from "sonner";
import { create } from "zustand";

export interface AiMessage {
  id: number;
  session_id: string;
  role: "user" | "assistant" | "system";
  content: string;
  a2ui_payload?: Record<string, unknown>;
  context_logs?: number[];
  timestamp: string;
  provider_session_id?: string;
}

export interface AiSession {
  session_id: string;
  name: string;
  created_at: string;
  last_modified: string;
  provider_session_id?: string;
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
    reasoning?: boolean;
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
      const msg = (err as Error).message;
      set({ error: msg });
      toast.error("Failed to fetch sessions", { description: msg });
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
      const msg = (err as Error).message;
      set({ error: msg });
      toast.error("Failed to rename session", { description: msg });
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
      const msg = (err as Error).message;
      set({ error: msg });
      toast.error("Failed to delete session", { description: msg });
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
      const msg = (err as Error).message;
      set({ error: msg, isLoading: false });
      toast.error("Error", { description: msg });
    }
  },

  sendMessage: async (params) => {
    let { currentSessionId } = get();
    set({ isLoading: true, error: null });

    const tempUserMsg: AiMessage = {
      id: Date.now(),
      session_id: currentSessionId || "temp",
      role: "user",
      content: params.message,
      context_logs: params.context_logs,
      timestamp: new Date().toISOString(),
    };

    const tempAssistantMsg: AiMessage = {
      id: Date.now() + 1,
      session_id: currentSessionId || "temp",
      role: "assistant",
      content: "",
      timestamp: new Date().toISOString(),
    };

    set((state) => ({
      messages: [...state.messages, tempUserMsg, tempAssistantMsg],
    }));

    try {
      // Connect to SSE Endpoint
      const response = await fetch(`${SIDECAR_BASE_URL}/api/stream_chat`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Accept: "text/event-stream",
        },
        body: JSON.stringify({
          ...params,
          session_id: currentSessionId,
        }),
      });

      if (!response.body) {
        throw new Error("No readable stream available");
      }

      const reader = response.body.getReader();
      const decoder = new TextDecoder("utf-8");

      let done = false;
      let buffer = "";

      while (!done) {
        const { value, done: readerDone } = await reader.read();
        done = readerDone;
        if (value) {
          buffer += decoder.decode(value, { stream: true });

          const lines = buffer.split("\n\n");
          buffer = lines.pop() || ""; // Keep the incomplete line in the buffer

          for (const line of lines) {
            if (line.startsWith("data: ")) {
              const dataStr = line.slice(6).trim();
              if (dataStr === "[DONE]") {
                done = true;
                break;
              }

              try {
                const parsed = JSON.parse(dataStr);

                if (parsed.error) {
                  throw new Error(parsed.error);
                }

                if (parsed.session_id && !currentSessionId) {
                  currentSessionId = parsed.session_id;
                  set({ currentSessionId });
                }

                if (parsed.a2ui_payload) {
                  set((state) => {
                    const messages = [...state.messages];
                    const lastMsg = messages.at(-1);
                    if (lastMsg) {
                      lastMsg.a2ui_payload = parsed.a2ui_payload;
                    }
                    return { messages };
                  });
                }

                if (parsed.chunk) {
                  set((state) => {
                    const messages = [...state.messages];
                    const lastMsg = messages.at(-1);
                    if (lastMsg) {
                      lastMsg.content += parsed.chunk;
                    }
                    // Update temp session id if resolving dynamically
                    if (currentSessionId && lastMsg && lastMsg.session_id === "temp") {
                      lastMsg.session_id = currentSessionId;
                      const prevMsg = messages.at(-2);
                      if (prevMsg) {
                        prevMsg.session_id = currentSessionId;
                      }
                    }
                    return { messages };
                  });
                }
              } catch (e) {
                console.warn("Error parsing chunk", dataStr, e);
              }
            }
          }
        }
      }

      set({ isLoading: false });

      if (currentSessionId) {
        await get().fetchSessions(params.workspace_id);
        await get().fetchMapping(params.workspace_id);
        // Wait for backend transactions to commit by introducing a tiny delay
        setTimeout(() => get().fetchMessages(currentSessionId as string), 200);
      }
    } catch (err) {
      set({ error: (err as Error).message, isLoading: false });
    }
  },

  clearError: () => set({ error: null }),
}));
