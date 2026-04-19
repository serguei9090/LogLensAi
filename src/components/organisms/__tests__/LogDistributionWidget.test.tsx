import { GlobalRegistrator } from "@happy-dom/global-registrator";
GlobalRegistrator.register();
Object.defineProperty(globalThis, "document", { value: window.document, configurable: true });
Object.defineProperty(globalThis, "window", { value: window, configurable: true });

// Mock ResizeObserver globally to avoid happy-dom issues with Recharts
global.ResizeObserver = class {
  observe() {}
  unobserve() {}
  disconnect() {}
};

import { render, waitFor } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { LogDistributionWidget } from "../LogDistributionWidget";

vi.mock("@tauri-apps/api/core", () => ({
  invoke: vi.fn().mockResolvedValue({
    buckets: [{ bucket: "2023-10-25 10:00", INFO: 5, ERROR: 2 }],
  }),
}));

describe("LogDistributionWidget", () => {
  it("renders a chart container when data is loaded", async () => {
    // Render the widget inside a wrapper so HappyDOM container has dimensions
    const { container, getByText } = render(
      <div style={{ width: 500, height: 200 }}>
        <LogDistributionWidget workspaceId="ws1" />
      </div>,
    );

    // Check loading state first
    expect(getByText("Synchronizing timeline data...")).toBeDefined();

    // Wait for the container to render after loading
    await waitFor(() => {
      // Recharts injects SVG elements
      expect(container.querySelector(".recharts-responsive-container")).toBeDefined();
    });
  });
});
