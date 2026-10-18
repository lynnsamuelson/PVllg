import { fireEvent, render, screen } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { describe, expect, it, vi } from "vitest";
import App from "./App.jsx";
import * as auth from "./context/AuthContext.jsx";
import { ROUTES } from "./routes.js";

const PERSON = { name: "Ada", email: "ada@example.com", account_type: "person", joined: "2026-10-01T12:00:00Z" };

function renderAt(url, user = null) {
  vi.spyOn(auth, "useAuth").mockReturnValue({ user, loading: false });
  render(
    <MemoryRouter initialEntries={[url]} future={{ v7_startTransition: true, v7_relativeSplatPath: true }}>
      <App />
    </MemoryRouter>
  );
}

describe("App routes", () => {
  it("shows the welcome screen without a bottom bar when logged out", () => {
    renderAt(ROUTES.welcome);
    expect(screen.getByRole("link", { name: "Get started" })).toBeInTheDocument();
    expect(screen.queryByRole("navigation", { name: "Main" })).not.toBeInTheDocument();
  });

  it("shows the forgot-password placeholder", () => {
    renderAt(ROUTES.forgotPassword);
    fireEvent.change(screen.getByLabelText("Email"), { target: { value: "ada@example.com" } });
    fireEvent.click(screen.getByRole("button", { name: "Send reset link" }));
    expect(screen.getByText("If an account exists for ada@example.com, a reset link would be sent.")).toBeInTheDocument();
  });

  it("shows signed-in tabs with the bottom bar", () => {
    renderAt(ROUTES.impact, PERSON);
    expect(screen.getByRole("heading", { name: "Impact" })).toBeInTheDocument();
    expect(screen.getByText("Impact numbers are for organizations.")).toBeInTheDocument();
    expect(screen.getByRole("navigation", { name: "Main" })).toBeInTheDocument();
  });

  it("shows not found for unknown URLs", () => {
    renderAt("/no-such-page");
    expect(screen.getByRole("heading", { name: "Page not found" })).toBeInTheDocument();
  });
});
