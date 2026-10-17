import { fireEvent, render, screen } from "@testing-library/react";
import { MemoryRouter, Route, Routes } from "react-router-dom";
import { describe, expect, it, vi } from "vitest";
import * as auth from "../../context/AuthContext.jsx";
import { ROUTES } from "../../routes.js";
import LoginPage from "./LoginPage.jsx";

function renderLogin({ user = null, login = vi.fn(), state } = {}) {
  vi.spyOn(auth, "useAuth").mockReturnValue({ user, login });
  render(
    <MemoryRouter initialEntries={[{ pathname: ROUTES.login, state }]} future={{ v7_startTransition: true, v7_relativeSplatPath: true }}>
      <Routes>
        <Route path={ROUTES.login} element={<LoginPage />} />
        <Route path={ROUTES.home} element={<p>Home</p>} />
        <Route path={ROUTES.orgItems} element={<p>My items</p>} />
        <Route path={ROUTES.claims} element={<p>Claims</p>} />
      </Routes>
    </MemoryRouter>
  );
  return login;
}

function submit() {
  fireEvent.change(screen.getByLabelText("Email"), { target: { value: "ada@example.com" } });
  fireEvent.change(screen.getByLabelText("Password"), { target: { value: "pw" } });
  fireEvent.click(screen.getByRole("button", { name: "Sign in" }));
}

describe("LoginPage", () => {
  it("signs in with the typed email and password", async () => {
    const login = renderLogin({ login: vi.fn().mockResolvedValue({}) });
    submit();
    expect(login).toHaveBeenCalledWith("ada@example.com", "pw");
    expect(await screen.findByRole("button", { name: "Sign in" })).toBeEnabled();
  });

  it("shows why sign-in failed", async () => {
    renderLogin({ login: vi.fn().mockRejectedValue(new Error("Incorrect email or password.")) });
    submit();
    expect(await screen.findByText("Incorrect email or password.")).toBeInTheDocument();
  });

  it.each([
    [{ account_type: "person" }, undefined, "Home"],
    [{ account_type: "organization" }, undefined, "My items"],
    [{ account_type: "person" }, { from: { pathname: ROUTES.claims } }, "Claims"],
  ])("sends a signed-in %o to where they were headed", (user, state, page) => {
    renderLogin({ user, state });
    expect(screen.getByText(page)).toBeInTheDocument();
  });
});
