import { render, screen } from "@testing-library/react";
import { MemoryRouter, Route, Routes } from "react-router-dom";
import { describe, expect, it, vi } from "vitest";
import * as auth from "../context/AuthContext.jsx";
import { ROUTES } from "../routes.js";
import ProtectedRoute from "./ProtectedRoute.jsx";

function renderAt(path) {
  render(
    <MemoryRouter initialEntries={[path]} future={{ v7_startTransition: true, v7_relativeSplatPath: true }}>
      <Routes>
        <Route path={ROUTES.login} element={<p>Login page</p>} />
        <Route element={<ProtectedRoute />}>
          <Route path={ROUTES.home} element={<p>Secret page</p>} />
        </Route>
      </Routes>
    </MemoryRouter>
  );
}

describe("ProtectedRoute", () => {
  it("shows loading while the session check runs", () => {
    vi.spyOn(auth, "useAuth").mockReturnValue({ user: null, loading: true });
    renderAt(ROUTES.home);
    expect(screen.getByText("Loading…")).toBeInTheDocument();
  });

  it("redirects logged-out visitors to login", () => {
    vi.spyOn(auth, "useAuth").mockReturnValue({ user: null, loading: false });
    renderAt(ROUTES.home);
    expect(screen.getByText("Login page")).toBeInTheDocument();
  });

  it("renders the page for logged-in users", () => {
    vi.spyOn(auth, "useAuth").mockReturnValue({ user: { name: "Ada" }, loading: false });
    renderAt(ROUTES.home);
    expect(screen.getByText("Secret page")).toBeInTheDocument();
  });
});
