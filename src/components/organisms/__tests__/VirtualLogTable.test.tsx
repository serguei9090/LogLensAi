import { useAiStore } from "@/store/aiStore";
import { useInvestigationStore } from "@/store/investigationStore";
import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { type LogEntry, VirtualLogTable } from "../VirtualLogTable";

// Mock virtualization
vi.mock("@tanstack/react-virtual", () => ({
  useVirtualizer: vi.fn().mockImplementation(({ count }) => ({
    getTotalSize: () => count * 40,
    getVirtualItems: () =>
      Array.from({ length: count }, (_, i) => ({
        index: i,
        start: i * 40,
        key: i,
        size: 40,
      })),
    scrollToIndex: vi.fn(),
    measureElement: vi.fn(),
  })),
}));

// Mock ResizeObserver globally to avoid issues with standard jsdom
globalThis.ResizeObserver = class {
  observe() {
    /* Mock */
  }
  unobserve() {
    /* Mock */
  }
  disconnect() {
    /* Mock */
  }
};

// Mock stores
vi.mock("@/store/investigationStore", () => ({
  useInvestigationStore: vi.fn().mockReturnValue({
    selectedLogIds: [],
    filters: [],
    setFilters: vi.fn(),
    toggleLogSelection: vi.fn(),
    clearSelection: vi.fn(),
    setSelectedLogIds: vi.fn(),
  }),
}));

vi.mock("@/store/aiStore", () => ({
  useAiStore: Object.assign(
    vi.fn().mockReturnValue({
      setSidebarOpen: vi.fn(),
      setSession: vi.fn(),
      logSessionMap: {},
      fetchMapping: vi.fn(),
    }),
    {
      getState: () => ({
        setSidebarOpen: vi.fn(),
      }),
    },
  ),
}));

vi.mock("@/store/workspaceStore", () => ({
  useWorkspaceStore: vi.fn().mockReturnValue({ id: "ws1" }),
  selectActiveWorkspace: vi.fn(),
}));

// Mock portal
vi.mock("react-dom", async () => {
  const actual = await vi.importActual("react-dom");
  return {
    // biome-ignore lint/suspicious/noExplicitAny: Mocking react-dom module
    ...(actual as any),
    // biome-ignore lint/suspicious/noExplicitAny: Mocking react-dom portal
    createPortal: (node: any) => node,
  };
});

describe("VirtualLogTable", () => {
  const mockLogs: LogEntry[] = [
    {
      id: 1,
      timestamp: "2023-10-25 10:00:00",
      level: "INFO",
      message: "Test log 1",
      cluster_id: "c1",
    },
    {
      id: 2,
      timestamp: "2023-10-25 10:01:00",
      level: "ERROR",
      message: "Test log 2",
      cluster_id: "c2",
    },
  ];

  const defaultProps = {
    logs: mockLogs,
    highlights: [],
    onAddComment: vi.fn(),
    onSort: vi.fn(),
    sortBy: "timestamp",
    sortOrder: "desc" as const,
  };

  it("renders log IDs and messages", () => {
    render(<VirtualLogTable {...defaultProps} />);
    expect(screen.getByText("Test log 1")).toBeDefined();
    expect(screen.getByText("Test log 2")).toBeDefined();
  });

  it("calls onSort when a header is clicked", () => {
    render(<VirtualLogTable {...defaultProps} />);
    const idHeader = screen.getByText(/ID/);
    fireEvent.click(idHeader);
    expect(defaultProps.onSort).toHaveBeenCalledWith("id");
  });

  it("highlights the ERROR level with correct badge", () => {
    render(<VirtualLogTable {...defaultProps} />);
    expect(screen.getByText("ERROR")).toBeDefined();
  });

  it("triggers row selection on click", () => {
    const store = vi.mocked(useInvestigationStore)();

    render(<VirtualLogTable {...defaultProps} />);
    const row = screen.getByText("Test log 1").closest("tr");
    if (row) {
      fireEvent.click(row);
    }

    expect(store.setSelectedLogIds).toHaveBeenCalledWith([1]);
  });

  it("toggles the note editor when clicking the note icon", () => {
    render(<VirtualLogTable {...defaultProps} />);

    // Find note icons - multiple logs have them
    const noteBtns = screen.getAllByLabelText("Add Note");
    fireEvent.click(noteBtns[0]);

    // Should show the note editor
    expect(screen.getByPlaceholderText(/Add investigation details/i)).toBeDefined();
    expect(screen.getByText(/Log Entry Annotation/i)).toBeDefined();
  });

  it("triggers cluster analysis when clicking a cluster ID", () => {
    const onAnalyzeCluster = vi.fn();
    render(<VirtualLogTable {...defaultProps} onAnalyzeCluster={onAnalyzeCluster} />);

    // Cluster buttons have ID labels
    const clusterBtn = screen.getByText("#c1");
    fireEvent.click(clusterBtn);

    expect(onAnalyzeCluster).toHaveBeenCalledWith("c1");
  });
});
