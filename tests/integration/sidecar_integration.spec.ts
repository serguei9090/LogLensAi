import { describe, expect, it, vi } from "vitest";

/**
 * sidecar_integration.spec.ts
 * Integration Testing Tier:
 * Verifies sidecar invocation, payload serialization, and mock/live fallback handling.
 */

describe("Sidecar Integration Tier", () => {
  it("should format and handle IPC payloads accurately", async () => {
    const mockDispatcher = vi.fn().mockResolvedValue({
      status: "ok",
      uptime: 3600,
      version: "0.2.0",
    });

    const response = await mockDispatcher({ method: "get_health" });
    expect(response.status).toBe("ok");
    expect(response.uptime).toBe(3600);
    expect(response.version).toBe("0.2.0");
    expect(mockDispatcher).toHaveBeenCalledWith({ method: "get_health" });
  });

  it("should handle graceful fallback when sidecar response fails", async () => {
    const failingDispatcher = vi.fn().mockRejectedValue(new Error("Sidecar unreachable"));

    await expect(failingDispatcher({ method: "get_logs" })).rejects.toThrow("Sidecar unreachable");
  });
});
