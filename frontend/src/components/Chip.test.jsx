import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import Checkbox from "./Checkbox.jsx";
import Chip from "./Chip.jsx";
import ProgressBar from "./ProgressBar.jsx";

describe("Chip", () => {
  it("is a radio that reports when picked", () => {
    const onSelect = vi.fn();
    render(
      <Chip selected={false} onSelect={onSelect}>
        Both
      </Chip>
    );
    const chip = screen.getByRole("radio", { name: "Both" });
    expect(chip).toHaveAttribute("aria-checked", "false");
    expect(chip).not.toHaveClass("selected");
    fireEvent.click(chip);
    expect(onSelect).toHaveBeenCalled();
  });

  it("shows when it is selected", () => {
    render(<Chip selected>Both</Chip>);
    expect(screen.getByRole("radio", { name: "Both" })).toHaveClass("chip selected");
  });

  it("is a checkbox in a group where several can be picked", () => {
    render(
      <Chip multiple selected>
        Foster families
      </Chip>
    );
    expect(screen.getByRole("checkbox", { name: "Foster families" })).toHaveAttribute("aria-checked", "true");
  });
});

describe("Checkbox", () => {
  it("passes the new checked state", () => {
    const onChange = vi.fn();
    render(<Checkbox label="Parent" checked={false} onChange={onChange} />);
    fireEvent.click(screen.getByRole("checkbox", { name: "Parent" }));
    expect(onChange).toHaveBeenCalledWith(true);
  });
});

describe("ProgressBar", () => {
  it("shows the step and fills to match", () => {
    render(<ProgressBar step={2} total={4} />);
    expect(screen.getByText("Step 2 of 4")).toBeInTheDocument();
    expect(screen.getByRole("progressbar", { name: "Step 2 of 4" }).firstChild).toHaveStyle({ width: "50%" });
  });

  it("adds the step's title when given", () => {
    render(<ProgressBar step={1} total={2} title="About the item" />);
    expect(screen.getByText("Step 1 of 2 · About the item")).toBeInTheDocument();
  });
});
