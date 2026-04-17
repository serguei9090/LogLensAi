import { beforeEach, describe, expect, it } from "vitest";
import { useInvestigationStore } from "../investigationStore";

describe("investigationStore", () => {
  beforeEach(() => {
    // Reset store before each test
    useInvestigationStore.setState({
      searchQuery: "",
      filters: [],
      highlights: [],
      logs: [],
      total: 0,
      offset: 0,
      sortBy: "timestamp",
      sortOrder: "desc",
      timeRange: { start: "", end: "" },
      isTailing: false,
      showDistribution: false,
      showAnomalies: false,
      currentSourceId: "aggregate",
      sourceStates: {},
    });
  });

  it("can set basic states", () => {
    const store = useInvestigationStore.getState();
    store.setSearchQuery("error");
    store.setTailing(true);
    store.setSort("level", "asc");

    expect(useInvestigationStore.getState().searchQuery).toBe("error");
    expect(useInvestigationStore.getState().isTailing).toBe(true);
    expect(useInvestigationStore.getState().sortBy).toBe("level");
  });

  it("isolates state between sources via syncActiveSource", () => {
    const store = useInvestigationStore.getState();

    // 1. Setup 'aggregate' view
    store.setSearchQuery("global search");
    store.setFilters([{ id: "f1", field: "level", operator: "equals", value: "ERROR" }]);

    // 2. Switch to 'source-1'
    store.syncActiveSource("source-1");
    // Verify it started with defaults
    expect(useInvestigationStore.getState().searchQuery).toBe("");
    expect(useInvestigationStore.getState().currentSourceId).toBe("source-1");

    // 3. Modify 'source-1'
    store.setSearchQuery("local search");

    // 4. Switch back to 'aggregate'
    store.syncActiveSource("aggregate");
    expect(useInvestigationStore.getState().searchQuery).toBe("global search");
    expect(useInvestigationStore.getState().filters).toHaveLength(1);

    // 5. Switch back to 'source-1'
    store.syncActiveSource("source-1");
    expect(useInvestigationStore.getState().searchQuery).toBe("local search");
  });

  it("can update a specific log entry by ID", () => {
    const store = useInvestigationStore.getState();
    const mockLogs = [
      { id: 1, raw_text: "log 1", has_comment: false },
      { id: 2, raw_text: "log 2", has_comment: false },
      // biome-ignore lint/suspicious/noExplicitAny: Mock data for testing
    ] as any;

    store.setLogs(mockLogs, 2);
    store.updateLog(1, { has_comment: true, comment: "Hello" });

    const updated = useInvestigationStore.getState().logs;
    expect(updated.find((l) => l.id === 1)?.has_comment).toBe(true);
    expect(updated.find((l) => l.id === 2)?.has_comment).toBe(false);
  });
});
