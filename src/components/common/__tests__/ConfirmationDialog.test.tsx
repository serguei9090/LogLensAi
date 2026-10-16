import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { ConfirmationDialog } from "../ConfirmationDialog";

describe("ConfirmationDialog", () => {
  it("should render when open", () => {
    render(
      <ConfirmationDialog
        isOpen={true}
        onOpenChange={() => {}}
        onConfirm={() => {}}
        title="Delete Item"
        description="Are you sure?"
      />,
    );
    expect(screen.getByText("Delete Item")).toBeDefined();
    expect(screen.getByText("Are you sure?")).toBeDefined();
  });

  it("should call onConfirm when confirm button is clicked", () => {
    const onConfirm = vi.fn();
    render(
      <ConfirmationDialog
        isOpen={true}
        onOpenChange={() => {}}
        onConfirm={onConfirm}
        title="Delete Item"
        description="Are you sure?"
      />,
    );

    const button = screen.getByText(/confirm/i);
    fireEvent.click(button);

    expect(onConfirm).toHaveBeenCalled();
  });

  it("should call onOpenChange(false) when cancel button is clicked", () => {
    const onOpenChange = vi.fn();
    render(
      <ConfirmationDialog
        isOpen={true}
        onOpenChange={onOpenChange}
        onConfirm={() => {}}
        title="Delete Item"
        description="Are you sure?"
      />,
    );

    const button = screen.getByText(/cancel/i);
    fireEvent.click(button);

    expect(onOpenChange).toHaveBeenCalledWith(false);
  });
});
