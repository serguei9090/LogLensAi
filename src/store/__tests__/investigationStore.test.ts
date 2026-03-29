import { beforeEach, describe, expect, it } from "vitest";
import { useInvestigationStore } from "../investigationStore";

describe("investigationStore", () => {
  beforeEach(() => {
    // Reset store before each test
    useInvestigationStore.setState({
      filters: [],
      searchQuery: "",
    });
  });

  it("can set filters", () => {
    const filters = [
      { id: "1", field: "raw_text" as const, operator: "contains" as const, value: "error" },
    ];
    useInvestigationStore.getState().setFilters(filters);
    expect(useInvestigationStore.getState().filters).toEqual(filters);
  });
});
