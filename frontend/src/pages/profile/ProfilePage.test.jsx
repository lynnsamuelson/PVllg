import { fireEvent, render, screen } from "@testing-library/react";
import { MemoryRouter, Route, Routes } from "react-router-dom";
import { describe, expect, it, vi } from "vitest";
import * as auth from "../../context/AuthContext.jsx";
import { ROUTES } from "../../routes.js";
import ProfilePage from "./ProfilePage.jsx";

describe("ProfilePage", () => {
  it("shows the account and signs out to the welcome screen", async () => {
    const logout = vi.fn().mockResolvedValue();
    vi.spyOn(auth, "useAuth").mockReturnValue({
      user: { name: "Ada", email: "ada@example.com", joined: "2026-10-01T12:00:00Z" },
      logout,
    });
    render(
      <MemoryRouter initialEntries={[ROUTES.profile]} future={{ v7_startTransition: true, v7_relativeSplatPath: true }}>
        <Routes>
          <Route path={ROUTES.profile} element={<ProfilePage />} />
          <Route path={ROUTES.welcome} element={<p>Welcome screen</p>} />
        </Routes>
      </MemoryRouter>
    );
    expect(screen.getByText("ada@example.com")).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "Sign out" }));
    expect(await screen.findByText("Welcome screen")).toBeInTheDocument();
    expect(logout).toHaveBeenCalled();
  });
});
