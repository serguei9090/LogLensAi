import { renderHook } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { useKeyboardShortcuts } from "../useKeyboardShortcuts";

describe("useKeyboardShortcuts", () => {
  it("should call the handler when the correct key is pressed", () => {
    const handler = vi.fn();
    const shortcuts = [
      {
        key: "k",
        ctrl: true,
        handler,
        description: "Test Shortcut",
      },
    ];

    renderHook(() => useKeyboardShortcuts(shortcuts));

    const event = new KeyboardEvent("keydown", {
      key: "k",
      ctrlKey: true,
    });

    window.dispatchEvent(event);

    expect(handler).toHaveBeenCalled();
  });

  it("should handle meta key as ctrl key on Mac (simulated)", () => {
    const handler = vi.fn();
    const shortcuts = [
      {
        key: "k",
        ctrl: true,
        handler,
        description: "Test Shortcut",
      },
    ];

    renderHook(() => useKeyboardShortcuts(shortcuts));

    const event = new KeyboardEvent("keydown", {
      key: "k",
      metaKey: true,
    });

    window.dispatchEvent(event);

    expect(handler).toHaveBeenCalled();
  });

  it("should not call the handler when the wrong key is pressed", () => {
    const handler = vi.fn();
    const shortcuts = [
      {
        key: "k",
        ctrl: true,
        handler,
        description: "Test Shortcut",
      },
    ];

    renderHook(() => useKeyboardShortcuts(shortcuts));

    const event = new KeyboardEvent("keydown", {
      key: "j",
      ctrlKey: true,
    });

    window.dispatchEvent(event);

    expect(handler).not.toHaveBeenCalled();
  });

  it("should not call the handler when modifiers don't match", () => {
    const handler = vi.fn();
    const shortcuts = [
      {
        key: "k",
        ctrl: true,
        handler,
        description: "Test Shortcut",
      },
    ];

    renderHook(() => useKeyboardShortcuts(shortcuts));

    const event = new KeyboardEvent("keydown", {
      key: "k",
      ctrlKey: false,
    });

    window.dispatchEvent(event);

    expect(handler).not.toHaveBeenCalled();
  });

  it("should call preventDefault on match", () => {
    const handler = vi.fn();
    const shortcuts = [
      {
        key: "k",
        ctrl: true,
        handler,
        description: "Test Shortcut",
      },
    ];

    renderHook(() => useKeyboardShortcuts(shortcuts));

    const event = new KeyboardEvent("keydown", {
      key: "k",
      ctrlKey: true,
    });

    vi.spyOn(event, "preventDefault");

    window.dispatchEvent(event);

    expect(event.preventDefault).toHaveBeenCalled();
  });
});
