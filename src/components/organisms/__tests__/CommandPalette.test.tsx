import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { CommandPalette } from "../CommandPalette";

// Mock the stores
vi.mock("@/store/uiStore", () => ({
  useUIStore: () => ({
    toggleSidebar: vi.fn(),
    toggleFacetSidebar: vi.fn(),
  }),
}));

vi.mock("@/store/aiStore", () => ({
  useAiStore: () => ({
    setSidebarOpen: vi.fn(),
  }),
}));

vi.mock("@/store/workspaceStore", () => ({
  useWorkspaceStore: () => ({
    addWorkspace: vi.fn(),
  }),
}));

describe("CommandPalette", () => {
  it("should render when open", () => {
    render(<CommandPalette open={true} onOpenChange={() => {}} onNavSelect={() => {}} />);
    expect(screen.getByPlaceholderText(/Type a command or search/i)).toBeDefined();
  });

  it("should filter commands based on search input", () => {
    render(<CommandPalette open={true} onOpenChange={() => {}} onNavSelect={() => {}} />);

    const input = screen.getByPlaceholderText(/Type a command or search/i);
    fireEvent.change(input, { target: { value: "Dashboard" } });

    expect(screen.getByText("Go to Dashboard")).toBeDefined();
    expect(screen.queryByText("Toggle Main Sidebar")).toBeNull();
  });

  it("should call action when command is clicked", () => {
    const onNavSelect = vi.fn();
    render(<CommandPalette open={true} onOpenChange={() => {}} onNavSelect={onNavSelect} />);

    const button = screen.getByText("Go to Dashboard");
    fireEvent.click(button);

    expect(onNavSelect).toHaveBeenCalledWith("dashboard");
  });

  it("should close when action is executed", () => {
    const onOpenChange = vi.fn();
    render(<CommandPalette open={true} onOpenChange={onOpenChange} onNavSelect={() => {}} />);

    const button = screen.getByText("Go to Dashboard");
    fireEvent.click(button);

    expect(onOpenChange).toHaveBeenCalledWith(false);
  });
});
