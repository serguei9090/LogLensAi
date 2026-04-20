import { describe, expect, it, vi } from "vitest";
import { callSidecar } from "@/lib/hooks/useSidecarBridge";
import { useInvestigationStore } from "@/store/investigationStore";

// Mock fetch for web-mode sidecar calls
globalThis.fetch = vi.fn();

describe("Investigation Integration (Headless E2E)", () => {
  it("should fetch and store logs correctly from sidecar mock", async () => {
    const mockLogsResponse = {
      total: 2,
      logs: [
        {
          id: 1,
          timestamp: "2024-04-20 12:00:00",
          level: "ERROR",
          message: "Error 1",
          facets: { ip: "1.1.1.1" },
        },
        {
          id: 2,
          timestamp: "2024-04-20 12:05:00",
          level: "INFO",
          message: "Info 1",
          facets: { ip: "2.2.2.2" },
        },
      ],
      offset: 0,
      limit: 100,
    };

    const mockFacetsResponse = {
      ip: [
        { value: "1.1.1.1", count: 1 },
        { value: "2.2.2.2", count: 1 },
      ],
      level: [
        { value: "ERROR", count: 1 },
        { value: "INFO", count: 1 },
      ],
    };

    (fetch as any).mockResolvedValue({
      ok: true,
      json: async () => ({
        jsonrpc: "2.0",
        id: 1,
        result: mockLogsResponse, // First call: get_logs
      }),
    });

    const _store = useInvestigationStore.getState();

    // Simulate what InvestigationPage does
    const result = await callSidecar<typeof mockLogsResponse>({
      method: "get_logs",
      params: { workspace_id: "ws1" },
    });

    useInvestigationStore.getState().setLogs(result.logs, result.total);

    // Check store state
    expect(useInvestigationStore.getState().total).toBe(2);
    expect(useInvestigationStore.getState().logs).toHaveLength(2);
    expect(useInvestigationStore.getState().logs[0].message).toBe("Error 1");

    // Second call: get_metadata_facets
    (fetch as any).mockResolvedValue({
      ok: true,
      json: async () => ({
        jsonrpc: "2.0",
        id: 2,
        result: mockFacetsResponse,
      }),
    });

    const facetRes = await callSidecar<typeof mockFacetsResponse>({
      method: "get_metadata_facets",
      params: { workspace_id: "ws1" },
    });

    useInvestigationStore.getState().setAvailableFacets(facetRes);

    expect(useInvestigationStore.getState().availableFacets.ip).toBeDefined();
    expect(useInvestigationStore.getState().availableFacets.ip[0].value).toBe("1.1.1.1");
  });
});
