import { beforeEach, describe, expect, it, vi } from "vitest";
import { useWorkspaceStore } from "../workspaceStore";

// Mock state for unique IDs
let idCounter = 0;

// Mock the bridge
vi.mock("../../lib/hooks/useSidecarBridge", () => ({
  callSidecar: vi.fn(async (method, params) => {
    if (method === "create_log_source") {
      idCounter++;
      return { source_id: `mock-source-id-${idCounter}` };
    }
    if (method === "get_hierarchy") {
      return {
        workspace_id: params.workspace_id,
        root: { id: "root", name: "Root", children: [], sources: [] },
      };
    }
    return { status: "success" };
  }),
}));

describe("workspaceStore", () => {
  beforeEach(() => {
    // Reset store state before each test
    useWorkspaceStore.setState({
      workspaces: [],
      activeWorkspaceId: "",
    });
    idCounter = 0;
    vi.clearAllMocks();
  });

  it("can add and remove workspaces", () => {
    const store = useWorkspaceStore.getState();
    store.addWorkspace({ id: "ws1", name: "Workspace 1" });

    expect(useWorkspaceStore.getState().workspaces).toHaveLength(1);
    expect(useWorkspaceStore.getState().activeWorkspaceId).toBe("ws1");

    useWorkspaceStore.getState().removeWorkspace("ws1");
    expect(useWorkspaceStore.getState().workspaces).toHaveLength(0);
    expect(useWorkspaceStore.getState().activeWorkspaceId).toBe("");
  });

  it("can rename a workspace", () => {
    const store = useWorkspaceStore.getState();
    store.addWorkspace({ id: "ws1", name: "Old Name" });
    store.renameWorkspace("ws1", "New Name");

    expect(useWorkspaceStore.getState().workspaces[0].name).toBe("New Name");
  });

  it("can create a source in a workspace", async () => {
    const store = useWorkspaceStore.getState();
    store.addWorkspace({ id: "ws1", name: "WS 1" });

    const source = await store.createSource("ws1", {
      name: "test.log",
      type: "local",
      path: "/tmp/test.log",
    });

    expect(source.id).toBe("mock-source-id-1");
    const ws = useWorkspaceStore.getState().workspaces[0];
    expect(ws.sources).toHaveLength(1);
    expect(ws.sources[0].name).toBe("test.log");
    expect(ws.activeSourceId).toBe(source.id);
  });

  it("can switch active sources", async () => {
    const store = useWorkspaceStore.getState();
    store.addWorkspace({ id: "ws1", name: "WS 1" });
    const s1 = await store.createSource("ws1", { name: "s1", type: "local", path: "p1" });
    const s2 = await store.createSource("ws1", { name: "s2", type: "local", path: "p2" });

    // s1 was first, so it's active initially
    expect(useWorkspaceStore.getState().workspaces[0].activeSourceId).toBe(s1.id);

    store.setActiveSource("ws1", s2.id);
    expect(useWorkspaceStore.getState().workspaces[0].activeSourceId).toBe(s2.id);

    store.setActiveSource("ws1", null); // switch to aggregate view
    expect(useWorkspaceStore.getState().workspaces[0].activeSourceId).toBeNull();
  });

  it("adjusts active source when current active is removed", async () => {
    const store = useWorkspaceStore.getState();
    store.addWorkspace({ id: "ws1", name: "WS 1" });
    const s1 = await store.createSource("ws1", { name: "s1", type: "local", path: "p1" });
    const s2 = await store.createSource("ws1", { name: "s2", type: "local", path: "p2" });

    store.setActiveSource("ws1", s1.id);
    await store.removeSource("ws1", s1.id);

    // Should fall back to s2 (the first remaining source)
    expect(useWorkspaceStore.getState().workspaces[0].activeSourceId).toBe(s2.id);
  });
});
