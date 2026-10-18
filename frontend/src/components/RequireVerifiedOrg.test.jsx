import { render, screen } from "@testing-library/react";
import { MemoryRouter, Route, Routes } from "react-router-dom";
import { describe, expect, it, vi } from "vitest";
import * as auth from "../context/AuthContext.jsx";
import { ROUTES } from "../routes.js";
import RequireVerifiedOrg from "./RequireVerifiedOrg.jsx";

const NOTES = { title: "Organization profile", pendingNote: "Confirm your email first.", othersNote: "Only verified organizations." };

function renderAs(user, props = NOTES) {
  vi.spyOn(auth, "useAuth").mockReturnValue({ user });
  render(
    <MemoryRouter initialEntries={[ROUTES.orgProfile]} future={{ v7_startTransition: true, v7_relativeSplatPath: true }}>
      <Routes>
        <Route element={<RequireVerifiedOrg {...props} />}>
          <Route path={ROUTES.orgProfile} element={<p>Profile form</p>} />
        </Route>
      </Routes>
    </MemoryRouter>
  );
}

const org = (organization) => ({ account_type: "organization", organization });

describe("RequireVerifiedOrg", () => {
  it("lets a verified organization through", () => {
    renderAs(org({ status: "verified" }));
    expect(screen.getByText("Profile form")).toBeInTheDocument();
  });

  it("tells a pending organization why and links to the code screen", () => {
    renderAs(org({ status: "pending" }));
    expect(screen.queryByText("Profile form")).not.toBeInTheDocument();
    expect(screen.getByRole("heading", { name: "Organization profile" })).toBeInTheDocument();
    expect(screen.getByText("Confirm your email first.")).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "Confirm your email" })).toHaveAttribute("href", ROUTES.orgVerify);
  });

  it("sends an organization that never started to sign-up", () => {
    renderAs(org(null));
    expect(screen.getByRole("link", { name: "Confirm your email" })).toHaveAttribute("href", ROUTES.orgSignup);
  });

  it("keeps people out", () => {
    renderAs({ account_type: "person", organization: null });
    expect(screen.getByText("Only verified organizations.")).toBeInTheDocument();
    expect(screen.queryByRole("link")).not.toBeInTheDocument();
  });
});
