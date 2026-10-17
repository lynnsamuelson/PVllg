import { render, screen } from "@testing-library/react";
import { MemoryRouter, Route, Routes } from "react-router-dom";
import { describe, expect, it, vi } from "vitest";
import * as api from "../../api/client.js";
import * as auth from "../../context/AuthContext.jsx";
import { ROUTES } from "../../routes.js";
import HomePage from "./HomePage.jsx";

function renderHome(user = { name: "Ada", account_type: "person" }) {
  vi.spyOn(auth, "useAuth").mockReturnValue({ user });
  render(
    <MemoryRouter initialEntries={[ROUTES.home]} future={{ v7_startTransition: true, v7_relativeSplatPath: true }}>
      <Routes>
        <Route path={ROUTES.home} element={<HomePage />} />
        <Route path={ROUTES.orgItems} element={<p>My items</p>} />
      </Routes>
    </MemoryRouter>
  );
}

describe("HomePage", () => {
  it("shows loading, then the resources", async () => {
    vi.spyOn(api, "listResources").mockResolvedValue([{ id: 7, title: "Diaper bank", category: "Essentials", summary: "Free diapers" }]);
    renderHome();
    expect(screen.getByText("Loading…")).toBeInTheDocument();
    expect(await screen.findByRole("link", { name: "Diaper bank" })).toHaveAttribute("href", ROUTES.resource(7));
    expect(screen.getByRole("heading", { name: "Welcome, Ada" })).toBeInTheDocument();
  });

  it("says when there are no resources", async () => {
    vi.spyOn(api, "listResources").mockResolvedValue([]);
    renderHome();
    expect(await screen.findByText("No resources yet.")).toBeInTheDocument();
  });

  it("shows a load error", async () => {
    vi.spyOn(api, "listResources").mockRejectedValue(new Error("Server down"));
    renderHome();
    expect(await screen.findByText("Server down")).toBeInTheDocument();
    expect(screen.queryByText("Loading…")).not.toBeInTheDocument();
  });

  it("sends organizations to their items without loading resources", () => {
    const list = vi.spyOn(api, "listResources");
    renderHome({ name: "Closet", account_type: "organization" });
    expect(screen.getByText("My items")).toBeInTheDocument();
    expect(list).not.toHaveBeenCalled();
  });
});
