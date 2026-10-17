import { render, screen } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { describe, expect, it } from "vitest";
import { ROUTES } from "../routes.js";
import BottomNav from "./BottomNav.jsx";

function tabsFor(user, path = ROUTES.home) {
  render(
    <MemoryRouter initialEntries={[path]} future={{ v7_startTransition: true, v7_relativeSplatPath: true }}>
      <BottomNav user={user} />
    </MemoryRouter>
  );
  return screen.getAllByRole("link").map((a) => a.textContent);
}

describe("BottomNav", () => {
  it("shows a person four tabs while Give support is off", () => {
    expect(tabsFor({ account_type: "person" })).toEqual(["Home", "Search", "Claims", "Profile"]);
  });

  it("adds Give for a person with Give support on", () => {
    expect(tabsFor({ account_type: "person", gives: true })).toEqual(["Home", "Search", "Claims", "Give", "Profile"]);
  });

  it("shows an organization its four tabs", () => {
    expect(tabsFor({ account_type: "organization" })).toEqual(["Items", "Claims", "Impact", "Profile"]);
  });

  it("marks the current tab", () => {
    tabsFor({ account_type: "person" }, ROUTES.claims);
    expect(screen.getByRole("link", { name: "Claims" })).toHaveClass("active");
    expect(screen.getByRole("link", { name: "Home" })).not.toHaveClass("active");
  });
});
