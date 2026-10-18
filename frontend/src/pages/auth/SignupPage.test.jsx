import { fireEvent, render, screen } from "@testing-library/react";
import { useState } from "react";
import { flushSync } from "react-dom";
import { MemoryRouter, Route, Routes } from "react-router-dom";
import { describe, expect, it, vi } from "vitest";
import { ApiError } from "../../api/client.js";
import * as auth from "../../context/AuthContext.jsx";
import { ROUTES } from "../../routes.js";
import SignupPage from "./SignupPage.jsx";

function renderAt(url, signup = vi.fn()) {
  vi.spyOn(auth, "useAuth").mockReturnValue({ user: null, signup });
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

  function fillForm(confirm = "pw") {
    for (const [label, value] of [["Name", "Ada"], ["Email", "ada@example.com"], ["Password", "pw"], ["Confirm password", confirm]]) {
      fireEvent.change(screen.getByLabelText(label), { target: { value } });
    }
    fireEvent.click(screen.getByRole("button", { name: "Sign up" }));
  }

  it("catches mismatched passwords before calling the API", () => {
    const signup = vi.fn();
    renderAt(`${ROUTES.signup}?type=person`, signup);
    fillForm("other");
    expect(screen.getByText("Passwords don't match.")).toBeInTheDocument();
    expect(signup).not.toHaveBeenCalled();
  });

  it("shows field errors under their field and other errors at the top", async () => {
    const signup = vi
      .fn()
      .mockRejectedValueOnce(new ApiError("x", { email: ["An account with this email already exists."] }, 400))
      .mockRejectedValueOnce(new ApiError("Server down", {}, 500));
    renderAt(`${ROUTES.signup}?type=person`, signup);
    fillForm();
    expect(await screen.findByText("An account with this email already exists.")).toBeInTheDocument();
    fillForm();
    expect(await screen.findByText("Server down")).toBeInTheDocument();
  });

  it("sends a new person to profile setup even if the signed-in redirect renders first", async () => {
    // Force React to re-render with the new user before onSubmit navigates, the order that used to race.
    let setUser;
    const homeRendered = vi.fn();
    const signup = async () => {
      await Promise.resolve(); // like the network: the submitting state renders first
      const created = { name: "Ada", account_type: "person" };
      flushSync(() => setUser(created));
      return created;
    };
    function Harness() {
      const [user, set] = useState(null);
      setUser = set;
      vi.spyOn(auth, "useAuth").mockReturnValue({ user, signup });
      return (
        <Routes>
          <Route path={ROUTES.signup} element={<SignupPage />} />
          <Route path={ROUTES.home} element={<HomeSpy onRender={homeRendered} />} />
          <Route path={ROUTES.profileSetup} element={<p>Profile setup</p>} />
        </Routes>
      );
    }
    render(
      <MemoryRouter
        initialEntries={[`${ROUTES.signup}?type=person`]}
        // Transitions on (the React Router v7 default): an imperative navigate() after signup lost to the
        // signed-in redirect here.
        future={{ v7_startTransition: true, v7_relativeSplatPath: true }}
      >
        <Harness />
      </MemoryRouter>
    );
    for (const [label, value] of [["Name", "Ada"], ["Email", "ada@example.com"], ["Password", "pw"], ["Confirm password", "pw"]]) {
      fireEvent.change(screen.getByLabelText(label), { target: { value } });
    }
    fireEvent.click(screen.getByRole("button", { name: "Sign up" }));

    expect(await screen.findByText("Profile setup")).toBeInTheDocument();
    expect(homeRendered).not.toHaveBeenCalled();
  });
});

function HomeSpy({ onRender }) {
  onRender();
  return <p>Home</p>;
}
