import { GlobalRegistrator } from "@happy-dom/global-registrator";

GlobalRegistrator.register();
Object.defineProperty(globalThis, "document", { value: window.document, configurable: true });
Object.defineProperty(globalThis, "window", { value: window, configurable: true });

// Mock ResizeObserver globally to avoid happy-dom issues
global.ResizeObserver = class {
  observe() {}
  unobserve() {}
  disconnect() {}
};

import { render, waitFor } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { LogDistributionWidget } from "../LogDistributionWidget";

// Mock echarts globally for the virtual testing environment
vi.mock("echarts", () => {
  return {
    init: vi.fn().mockReturnValue({
      setOption: vi.fn(),
      resize: vi.fn(),
      on: vi.fn(),
      off: vi.fn(),
      dispatchAction: vi.fn(),
      dispose: vi.fn(),
    }),
  };
});

vi.mock("@tauri-apps/api/core", () => ({
  invoke: vi.fn().mockResolvedValue({
    buckets: [{ bucket: "2023-10-25 10:00", INFO: 5, ERROR: 2 }],
  }),
}));

describe("LogDistributionWidget", () => {
  it("renders a chart container when data is loaded", async () => {
    const { container, getByText } = render(
      <div style={{ width: 500, height: 200 }}>
        <LogDistributionWidget workspaceId="ws1" />
      </div>,
    );

    // Check loading state first
    expect(getByText("Synchronizing timeline data...")).toBeDefined();

    // Wait for the container to render after loading
    await waitFor(() => {
      // ReactECharts renders container with data-testid="echarts-container"
      expect(container.querySelector("[data-testid='echarts-container']")).toBeDefined();
    });
  });
});
