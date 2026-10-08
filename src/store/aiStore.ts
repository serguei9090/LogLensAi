import { toast } from "sonner";
import { create } from "zustand";
import { callSidecar, SIDECAR_BASE_URL } from "@/lib/hooks/useSidecarBridge";

export type SessionType = "investigation" | "dashboard";

export interface AiMessage {
  id: number;
  session_id: string;
  role: "user" | "assistant" | "system";
  content: string;
  a2ui_payload?: Record<string, unknown>;
  context_logs?: number[];
  timestamp: string;
  provider_session_id?: string;
  evaluation_notice?: string;
  steps?: { title: string; done?: boolean }[];
}

export interface AiSession {
  session_id: string;
  name: string;
  created_at: string;
  last_modified: string;
  provider_session_id?: string;
  session_type?: SessionType;
}

interface AiStore {
  // Investigation Page State
  currentSessionId: string | null;
  sessions: AiSession[];
  messages: AiMessage[];

  // Dashboard AI Insights State (Isolated Session)
  dashboardSessionId: string | null;
  dashboardSessions: AiSession[];
  dashboardMessages: AiMessage[];
  isDashboardLoading: boolean;

  isLoading: boolean;
  isSidebarOpen: boolean;
  sidebarWidth: number;
  error: string | null;
  logSessionMap: Record<number, string>; // log_id -> session_id
  dashboardWidgets: Record<string, unknown>[]; // Retained for compatibility
  abortController: AbortController | null;

  // Actions
  setSidebarOpen: (open: boolean) => void;
  setSidebarWidth: (width: number) => void;
  setSession: (sessionId: string | null) => void;
  setDashboardSession: (sessionId: string | null) => void;

  fetchSessions: (workspaceId: string) => Promise<void>;
  fetchMessages: (sessionId: string, target?: "investigation" | "dashboard") => Promise<void>;
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
    session_type?: SessionType;
  }) => Promise<void>;

  stopStream: () => void;
  clearError: () => void;
  addDashboardWidget: (widget: Record<string, unknown>) => void;
  clearDashboardWidgets: () => void;
}

export const useAiStore = create<AiStore>((set, get) => ({
  currentSessionId: null,
  sessions: [],
  messages: [],

  dashboardSessionId: null,
  dashboardSessions: [],
  dashboardMessages: [],
  isDashboardLoading: false,

  isLoading: false,
  isSidebarOpen: false,
  sidebarWidth: 450,
  error: null,
  logSessionMap: {},
  dashboardWidgets: [],
  abortController: null,

  setSidebarOpen: (isSidebarOpen) => set({ isSidebarOpen }),
  setSidebarWidth: (sidebarWidth) => set({ sidebarWidth }),

  setSession: (sessionId) => {
    set({ currentSessionId: sessionId });
    if (sessionId) {
      get().fetchMessages(sessionId, "investigation");
    } else {
      set({ messages: [] });
    }
  },

  setDashboardSession: (sessionId) => {
    set({ dashboardSessionId: sessionId });
    if (sessionId) {
      get().fetchMessages(sessionId, "dashboard");
    } else {
      set({ dashboardMessages: [] });
    }
  },

  fetchSessions: async (workspaceId) => {
    try {
      const rawSessions = await callSidecar<AiSession[]>({
        method: "get_ai_sessions",
        params: { workspace_id: workspaceId },
      });

      // Filter sessions by tag/prefix:
      // Sessions with name or ID starting with "Dashboard" or "DASH-" are dashboard sessions
      const dashboardSessions = rawSessions.filter(
        (s) =>
          s.name?.toLowerCase().includes("dashboard") ||
          s.session_id.startsWith("dash-") ||
          s.session_type === "dashboard",
      );
      const investigationSessions = rawSessions.filter(
        (s) =>
          !s.name?.toLowerCase().includes("dashboard") &&
          !s.session_id.startsWith("dash-") &&
          s.session_type !== "dashboard",
      );

      set({
        sessions: investigationSessions,
        dashboardSessions: dashboardSessions,
      });
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
      if (get().dashboardSessionId === sessionId) {
        set({ dashboardSessionId: null, dashboardMessages: [] });
      }
      await get().fetchSessions(workspaceId);
      await get().fetchMapping(workspaceId);
    } catch (err) {
      const msg = (err as Error).message;
      set({ error: msg });
      toast.error("Failed to delete session", { description: msg });
    }
  },

  fetchMessages: async (sessionId, target = "investigation") => {
    if (target === "dashboard") {
      set({ isDashboardLoading: true });
    } else {
      set({ isLoading: true });
    }

    try {
      const messages = await callSidecar<AiMessage[]>({
        method: "get_ai_messages",
        params: { session_id: sessionId },
      });

      const existing = target === "dashboard" ? get().dashboardMessages : get().messages;
      const merged = messages.map((m, idx) => {
        let content = m.content || "";
        let a2uiPayload = m.a2ui_payload;

        if (content.includes("[[A2UI]]")) {
          if (!a2uiPayload) {
            const allBlocks = [...content.matchAll(/\[\[A2UI\]\]([\s\S]*?)\[\[\/A2UI\]\]/g)]
              .map((b) => b[1].trim())
              .join("\n");
            if (allBlocks) {
              try {
                a2uiPayload = JSON.parse(allBlocks);
              } catch {
                a2uiPayload = { type: "markup", raw: allBlocks };
              }
            }
          }
          content = content.replaceAll(/\[\[A2UI\]\][\s\S]*?(\[\[\/A2UI\]\]|$)/g, "").trim();
        }

        const prev = existing.find(
          (e) => e.id === m.id || (idx === messages.length - 1 && e.role === m.role),
        );
        if (prev) {
          const rawSteps = prev.steps ?? m.steps;
          const steps = rawSteps?.map((s) => ({ ...s, done: true }));
          return {
            ...m,
            content,
            steps,
            evaluation_notice: prev.evaluation_notice ?? m.evaluation_notice,
            a2ui_payload: prev.a2ui_payload ?? a2uiPayload,
          };
        }
        return {
          ...m,
          content,
          a2ui_payload: a2uiPayload,
        };
      });

      if (target === "dashboard") {
        set({ dashboardMessages: merged, isDashboardLoading: false });
      } else {
        set({ messages: merged, isLoading: false });
      }
    } catch (err) {
      const msg = (err as Error).message;
      if (target === "dashboard") {
        set({ error: msg, isDashboardLoading: false });
      } else {
        set({ error: msg, isLoading: false });
      }
      toast.error("Error", { description: msg });
    }
  },

  sendMessage: async (params) => {
    const isDashboard = params.session_type === "dashboard";
    let activeSessionId = isDashboard ? get().dashboardSessionId : get().currentSessionId;

    if (isDashboard) {
      set({ isDashboardLoading: true, error: null });
    } else {
      set({ isLoading: true, error: null });
    }

    const tempUserMsg: AiMessage = {
      id: Date.now(),
      session_id: activeSessionId || "temp",
      role: "user",
      content: params.message,
      context_logs: params.context_logs,
      timestamp: new Date().toISOString(),
    };

    const tempAssistantMsg: AiMessage = {
      id: Date.now() + 1,
      session_id: activeSessionId || "temp",
      role: "assistant",
      content: "",
      timestamp: new Date().toISOString(),
    };

    if (isDashboard) {
      set((state) => ({
        dashboardMessages: [...state.dashboardMessages, tempUserMsg, tempAssistantMsg],
      }));
    } else {
      set((state) => ({
        messages: [...state.messages, tempUserMsg, tempAssistantMsg],
      }));
    }

    const controller = new AbortController();
    set({ abortController: controller });

    try {
      const defaultName = isDashboard
        ? `Dashboard Insight ${new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}`
        : undefined;

      const response = await fetch(`${SIDECAR_BASE_URL}/api/stream_chat`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Accept: "text/event-stream",
        },
        signal: controller.signal,
        body: JSON.stringify({
          ...params,
          session_id: activeSessionId,
          session_name: params.session_name || defaultName,
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
          buffer = lines.pop() || "";

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

                if (parsed.session_id && !activeSessionId) {
                  activeSessionId = parsed.session_id;
                  if (isDashboard) {
                    set({ dashboardSessionId: activeSessionId });
                  } else {
                    set({ currentSessionId: activeSessionId });
                  }
                }

                if (parsed.evaluation_notice) {
                  set((state) => {
                    const targetList = isDashboard ? state.dashboardMessages : state.messages;
                    const nextList = [...targetList];
                    const lastMsg = nextList.at(-1);
                    if (lastMsg) {
                      lastMsg.evaluation_notice = parsed.evaluation_notice;
                    }
                    return isDashboard ? { dashboardMessages: nextList } : { messages: nextList };
                  });
                }

                if (parsed.step) {
                  set((state) => {
                    const targetList = isDashboard ? state.dashboardMessages : state.messages;
                    const nextList = [...targetList];
                    const lastMsg = nextList.at(-1);
                    if (lastMsg) {
                      if (!lastMsg.steps) {
                        lastMsg.steps = [];
                      }
                      const existingIdx = lastMsg.steps.findIndex((s) => s.title === parsed.step);
                      if (existingIdx !== -1) {
                        if (parsed.step_done !== undefined) {
                          lastMsg.steps[existingIdx].done = parsed.step_done;
                        }
                      } else {
                        lastMsg.steps.push({
                          title: parsed.step,
                          done: parsed.step_done ?? false,
                        });
                      }
                    }
                    return isDashboard ? { dashboardMessages: nextList } : { messages: nextList };
                  });
                }

                if (parsed.a2ui_payload) {
                  set((state) => {
                    const targetList = isDashboard ? state.dashboardMessages : state.messages;
                    const nextList = [...targetList];
                    const lastMsg = nextList.at(-1);
                    if (lastMsg) {
                      lastMsg.a2ui_payload = parsed.a2ui_payload;
                    }
                    return isDashboard ? { dashboardMessages: nextList } : { messages: nextList };
                  });
                }

                if (parsed.chunk) {
                  set((state) => {
                    const targetList = isDashboard ? state.dashboardMessages : state.messages;
                    const nextList = [...targetList];
                    const lastMsg = nextList.at(-1);
                    if (lastMsg) {
                      let rawChunk = parsed.chunk;
                      if (rawChunk.includes("[[EVAL_NOTICE]]")) {
                        const match = rawChunk.match(
                          /\[\[EVAL_NOTICE\]\](.*?)\[\[\/EVAL_NOTICE\]\]/,
                        );
                        if (match) {
                          lastMsg.evaluation_notice = match[1];
                          rawChunk = rawChunk.replace(
                            /\[\[EVAL_NOTICE\]\].*?\[\[\/EVAL_NOTICE\]\]/,
                            "",
                          );
                        }
                      }
                      if (rawChunk) {
                        lastMsg.content += rawChunk;
                        if (lastMsg.steps && lastMsg.steps.length > 0) {
                          lastMsg.steps = lastMsg.steps.map((s) => ({ ...s, done: true }));
                        }
                      }
                    }
                    if (activeSessionId && lastMsg && lastMsg.session_id === "temp") {
                      lastMsg.session_id = activeSessionId;
                      const prevMsg = nextList.at(-2);
                      if (prevMsg) {
                        prevMsg.session_id = activeSessionId;
                      }
                    }
                    return isDashboard ? { dashboardMessages: nextList } : { messages: nextList };
                  });
                }
              } catch (e) {
                console.warn("Error parsing chunk", dataStr, e);
              }
            }
          }
        }
      }

      set((state) => {
        const targetList = isDashboard ? state.dashboardMessages : state.messages;
        const nextList = [...targetList];
        const lastMsg = nextList.at(-1);
        if (lastMsg) {
          if (lastMsg.steps && lastMsg.steps.length > 0) {
            lastMsg.steps = lastMsg.steps.map((s) => ({ ...s, done: true }));
          }

          // Extract and strip any raw [[A2UI]]...[[/A2UI]] blocks from content text
          if (lastMsg.content.includes("[[A2UI]]")) {
            if (!lastMsg.a2ui_payload) {
              const allBlocks = [
                ...lastMsg.content.matchAll(/\[\[A2UI\]\]([\s\S]*?)\[\[\/A2UI\]\]/g),
              ]
                .map((m) => m[1].trim())
                .join("\n");
              if (allBlocks) {
                try {
                  lastMsg.a2ui_payload = JSON.parse(allBlocks);
                } catch {
                  lastMsg.a2ui_payload = { type: "markup", raw: allBlocks };
                }
              }
            }
            lastMsg.content = lastMsg.content
              .replaceAll(/\[\[A2UI\]\][\s\S]*?(\[\[\/A2UI\]\]|$)/g, "")
              .trim();
          }
        }
        return isDashboard
          ? { dashboardMessages: nextList, isDashboardLoading: false, abortController: null }
          : { messages: nextList, isLoading: false, abortController: null };
      });

      if (activeSessionId) {
        await get().fetchSessions(params.workspace_id);
        if (!isDashboard) {
          await get().fetchMapping(params.workspace_id);
        }
        const sid = activeSessionId;
        setTimeout(
          () => get().fetchMessages(sid, isDashboard ? "dashboard" : "investigation"),
          200,
        );
      }
    } catch (err: unknown) {
      if ((err as Error)?.name === "AbortError") {
        set({ isLoading: false, isDashboardLoading: false, abortController: null });
        return;
      }
      set({
        error: (err as Error).message,
        isLoading: false,
        isDashboardLoading: false,
        abortController: null,
      });
    }
  },

  stopStream: () => {
    const { abortController } = get();
    if (abortController) {
      abortController.abort();
      set({ isLoading: false, isDashboardLoading: false, abortController: null });
    }
  },

  clearError: () => set({ error: null }),
  addDashboardWidget: (widget) =>
    set((state) => ({ dashboardWidgets: [...state.dashboardWidgets, widget] })),
  clearDashboardWidgets: () => set({ dashboardWidgets: [] }),
}));
