import { render, screen } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { describe, expect, it } from "vitest";
import Button from "./Button.jsx";

const inRouter = (ui) =>
  render(<MemoryRouter future={{ v7_startTransition: true, v7_relativeSplatPath: true }}>{ui}</MemoryRouter>);

describe("Button", () => {
  it("is a primary <button type=button> by default", () => {
    inRouter(<Button>Continue</Button>);
    const btn = screen.getByRole("button", { name: "Continue" });
    expect(btn).toHaveAttribute("type", "button");
    expect(btn).toHaveClass("btn", "btn-primary");
  });

  it("renders a link when given `to`", () => {
    inRouter(
      <Button variant="outline" to="/login">
        Sign in
      </Button>
    );
    const link = screen.getByRole("link", { name: "Sign in" });
    expect(link).toHaveAttribute("href", "/login");
    expect(link).toHaveClass("btn-outline");
  });

  it("supports the small size", () => {
    inRouter(<Button small>Edit</Button>);
    expect(screen.getByRole("button", { name: "Edit" })).toHaveClass("btn-small");
  });
});
