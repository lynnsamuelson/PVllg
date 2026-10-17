import { render, screen } from "@testing-library/react";
import { MemoryRouter, Route, Routes } from "react-router-dom";
import { describe, expect, it, vi } from "vitest";
import * as auth from "../../context/AuthContext.jsx";
import { ROUTES } from "../../routes.js";
import SignupPage from "./SignupPage.jsx";

function renderAt(url) {
  vi.spyOn(auth, "useAuth").mockReturnValue({ user: null, signup: vi.fn() });
  render(
    <MemoryRouter initialEntries={[url]} future={{ v7_startTransition: true, v7_relativeSplatPath: true }}>
      <Routes>
        <Route path={ROUTES.signup} element={<SignupPage />} />
        <Route path={ROUTES.accountType} element={<p>Pick a type</p>} />
      </Routes>
    </MemoryRouter>
  );
}

describe("SignupPage", () => {
  it("shows the form for a known account type", () => {
    renderAt(`${ROUTES.signup}?type=organization`);
    expect(screen.getByRole("heading", { name: "Create your account" })).toBeInTheDocument();
  });

  it.each(["", "?type=robot", "?type=constructor", "?type=__proto__"])("sends %s back to pick a type", (query) => {
    renderAt(`${ROUTES.signup}${query}`);
    expect(screen.getByText("Pick a type")).toBeInTheDocument();
  });
});
