import { render, screen } from "@testing-library/react";
import { MemoryRouter, Route, Routes } from "react-router-dom";
import { afterEach, describe, expect, it, vi } from "vitest";
import * as auth from "../context/AuthContext.jsx";
import { ROUTES } from "../routes.js";
import RequireGiver from "./RequireGiver.jsx";

function renderAs(user, props = {}) {
  vi.spyOn(auth, "useAuth").mockReturnValue({ user });
  render(
    <MemoryRouter initialEntries={[ROUTES.postItem]} future={{ v7_startTransition: true, v7_relativeSplatPath: true }}>
      <Routes>
        <Route element={<RequireGiver title="Post an item" {...props} />}>
          <Route path={ROUTES.postItem} element={<p>Post form</p>} />
        </Route>
      </Routes>
    </MemoryRouter>
  );
}

const org = (organization) => ({ account_type: "organization", organization });
const person = (gives) => ({ account_type: "person", organization: null, gives });

afterEach(() => vi.restoreAllMocks());

describe("RequireGiver", () => {
  it("lets a verified organization through", () => {
    renderAs(org({ status: "verified" }));
    expect(screen.getByText("Post form")).toBeInTheDocument();
  });

  it("lets a person with Give support through", () => {
    renderAs(person(true));
    expect(screen.getByText("Post form")).toBeInTheDocument();
  });

  it("keeps out a person without Give support", () => {
    renderAs(person(false));
    expect(screen.queryByText("Post form")).not.toBeInTheDocument();
    expect(screen.getByText("Posting items is for people with Give support on.")).toBeInTheDocument();
    expect(screen.queryByRole("link")).not.toBeInTheDocument();
  });

  it("lets any person through when asked (My items)", () => {
    renderAs(person(false), { anyPerson: true });
    expect(screen.getByText("Post form")).toBeInTheDocument();
  });

  it("tells a pending organization to confirm its email", () => {
    renderAs(org({ status: "pending" }));
    expect(screen.getByRole("heading", { name: "Post an item" })).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "Confirm your email" })).toHaveAttribute("href", ROUTES.orgVerify);
  });

  it("sends an organization that never started to sign-up", () => {
    renderAs(org(null));
    expect(screen.getByRole("link", { name: "Confirm your email" })).toHaveAttribute("href", ROUTES.orgSignup);
  });
});
