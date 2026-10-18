import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import Toggle from "./Toggle.jsx";

describe("Toggle", () => {
  it("is a labelled switch that reports the new state", () => {
    const onChange = vi.fn();
    render(<Toggle label="Give support" checked={false} onChange={onChange} />);
    fireEvent.click(screen.getByRole("switch", { name: "Give support" }));
    expect(onChange).toHaveBeenCalledWith(true);
  });
});
