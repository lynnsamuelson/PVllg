import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import Tabs from "./Tabs.jsx";

describe("Tabs", () => {
  it("marks the active tab and reports picks", () => {
    const onChange = vi.fn();
    const tabs = [
      { value: "items", label: "Items" },
      { value: "resources", label: "Resources" },
    ];
    render(<Tabs label="What" tabs={tabs} value="items" onChange={onChange} />);
    expect(screen.getByRole("tab", { name: "Items" })).toHaveAttribute("aria-selected", "true");
    fireEvent.click(screen.getByRole("tab", { name: "Resources" }));
    expect(onChange).toHaveBeenCalledWith("resources");
  });
});
