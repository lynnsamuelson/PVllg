import { render, screen } from "@testing-library/react";
import { MemoryRouter, Route, Routes } from "react-router-dom";
import { describe, expect, it, vi } from "vitest";
import * as auth from "../context/AuthContext.jsx";
import { ROUTES } from "../routes.js";
import RequireVerifiedOrg from "./RequireVerifiedOrg.jsx";

function renderAs(user, props = {}) {
  vi.spyOn(auth, "useAuth").mockReturnValue({ user });
  render(
    <MemoryRouter initialEntries={[ROUTES.postItem]} future={{ v7_startTransition: true, v7_relativeSplatPath: true }}>
      <Routes>
        <Route element={<RequireVerifiedOrg {...props} />}>
          <Route path={ROUTES.postItem} element={<p>Post form</p>} />
        </Route>
      </Routes>
    </MemoryRouter>
  );
}

const org = (organization) => ({ account_type: "organization", organization });

describe("RequireVerifiedOrg", () => {
  it("lets a verified organization through", () => {
    renderAs(org({ status: "verified" }));
    expect(screen.getByText("Post form")).toBeInTheDocument();
  });

  it("tells a pending organization why it can't post and links to the code screen", () => {
    renderAs(org({ status: "pending" }));
    expect(screen.queryByText("Post form")).not.toBeInTheDocument();
    expect(screen.getByText(/once your organization's email is confirmed/)).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "Confirm your email" })).toHaveAttribute("href", ROUTES.orgVerify);
  });

  it("sends an organization that never started to sign-up", () => {
    renderAs(org(null));
    expect(screen.getByRole("link", { name: "Confirm your email" })).toHaveAttribute("href", ROUTES.orgSignup);
  });

  it("takes a title and notes for other screens", () => {
    renderAs(org({ status: "pending" }), { title: "Organization profile", pendingNote: "Confirm first." });
    expect(screen.getByRole("heading", { name: "Organization profile" })).toBeInTheDocument();
    expect(screen.getByText("Confirm first.")).toBeInTheDocument();
  });

  it("keeps people out", () => {
    renderAs({ account_type: "person", organization: null });
    expect(screen.getByText("Only verified organizations can post here.")).toBeInTheDocument();
    expect(screen.queryByRole("link")).not.toBeInTheDocument();
  });
});
