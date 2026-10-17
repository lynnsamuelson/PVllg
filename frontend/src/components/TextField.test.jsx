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
});
