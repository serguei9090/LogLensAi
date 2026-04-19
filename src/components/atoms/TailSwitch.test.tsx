import { fireEvent, render, screen } from "@testing-library/react";
import { expect, test, vi } from "vitest";
import { TailSwitch } from "./TailSwitch";

test("renders TailSwitch and responds to clicks", () => {
  const handleChange = vi.fn();
  render(<TailSwitch checked={false} onCheckedChange={handleChange} />);

  const label = screen.getByText("Live Tail");
  expect(label).toBeDefined();

  const switchRole = screen.getByRole("switch");
  expect(switchRole.getAttribute("aria-checked")).toBe("false");

  fireEvent.click(switchRole);
  expect(handleChange).toHaveBeenCalledWith(true);
});
