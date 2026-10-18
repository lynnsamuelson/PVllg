import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import TextField from "./TextField.jsx";

describe("TextField", () => {
  it("labels the input and links its hint", () => {
    render(<TextField label="Password" type="password" hint="At least 8 characters" />);
    const input = screen.getByLabelText("Password");
    expect(input).toHaveAttribute("type", "password");
    expect(input).toHaveAccessibleDescription("At least 8 characters");
  });

  it("shows API errors and marks the input invalid", () => {
    render(<TextField label="Email" errors={["An account with this email already exists."]} />);
    expect(screen.getByText("An account with this email already exists.")).toBeInTheDocument();
    expect(screen.getByLabelText("Email")).toHaveAttribute("aria-invalid", "true");
  });

  it("is a dropdown with a blank first choice when given options", () => {
    render(<TextField label="Category" placeholder="Pick one" options={[{ value: "clothes", label: "Clothes & gear" }]} />);
    const select = screen.getByLabelText("Category");
    expect(select.tagName).toBe("SELECT");
    expect(screen.getAllByRole("option").map((o) => o.textContent)).toEqual(["Pick one", "Clothes & gear"]);
  });

  it("is a text box when multiline", () => {
    render(<TextField label="About us" multiline />);
    expect(screen.getByLabelText("About us").tagName).toBe("TEXTAREA");
  });
});
