import { render, screen } from "@testing-library/react";
import { MemoryRouter, Route, Routes } from "react-router-dom";
import { describe, expect, it, vi } from "vitest";
import * as api from "../../api/client.js";
import { ROUTES } from "../../routes.js";
import ResourceDetailPage from "./ResourceDetailPage.jsx";

function renderDetail() {
  render(
    <MemoryRouter initialEntries={[ROUTES.resource(7)]} future={{ v7_startTransition: true, v7_relativeSplatPath: true }}>
      <Routes>
        <Route path={ROUTES.resource()} element={<ResourceDetailPage />} />
      </Routes>
    </MemoryRouter>
  );
}

describe("ResourceDetailPage", () => {
  it("loads the resource from the URL and links out", async () => {
    const get = vi.spyOn(api, "getResource").mockResolvedValue({
      title: "Diaper bank",
      category: "Essentials",
      description: "Free diapers",
      url: "https://example.org",
    });
    renderDetail();
    expect(screen.getByText("Loading…")).toBeInTheDocument();
    expect(await screen.findByRole("heading", { name: "Diaper bank" })).toBeInTheDocument();
    expect(get).toHaveBeenCalledWith("7");
    expect(screen.getByRole("link", { name: "Visit resource ↗" })).toHaveAttribute("href", "https://example.org");
  });

  it("leaves out the link when there is no URL", async () => {
    vi.spyOn(api, "getResource").mockResolvedValue({ title: "Hotline", category: "Parenting", description: "", url: "" });
    renderDetail();
    await screen.findByRole("heading", { name: "Hotline" });
    expect(screen.queryByRole("link", { name: /Visit resource/ })).not.toBeInTheDocument();
  });

  it("says when the resource doesn't exist", async () => {
    vi.spyOn(api, "getResource").mockRejectedValue(new api.ApiError("Not found.", {}, 404));
    renderDetail();
    expect(await screen.findByRole("heading", { name: "Resource not found" })).toBeInTheDocument();
    expect(screen.queryByText("Not found.")).not.toBeInTheDocument();
  });

  it("shows other load errors", async () => {
    vi.spyOn(api, "getResource").mockRejectedValue(new api.ApiError("Server down", {}, 500));
    renderDetail();
    expect(await screen.findByRole("heading", { name: "Couldn't load this resource" })).toBeInTheDocument();
    expect(screen.getByText("Server down")).toBeInTheDocument();
  });
});
