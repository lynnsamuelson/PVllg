import { fireEvent, render, screen } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { afterEach, describe, expect, it, vi } from "vitest";
import * as api from "../../api/client.js";
import { ROUTES } from "../../routes.js";
import MyItemsPage, { countsLine } from "./MyItemsPage.jsx";

const CRIB = { id: 7, name: "Crib", left: 2, requested: 0, claimed: 0 };

function renderPage(state) {
  render(
    <MemoryRouter initialEntries={[{ pathname: ROUTES.give, state }]} future={{ v7_startTransition: true, v7_relativeSplatPath: true }}>
      <MyItemsPage />
    </MemoryRouter>
  );
}

afterEach(() => vi.restoreAllMocks());

describe("countsLine", () => {
  it("shows what's left, then requests and claims when there are any, never below zero", () => {
    expect(countsLine(CRIB)).toBe("2 left");
    expect(countsLine({ left: -1, requested: 1, claimed: 1 })).toBe("0 left · 1 requested · 1 claimed");
  });
});

describe("MyItemsPage", () => {
  it("lists items with Edit and Take down", async () => {
    vi.spyOn(api, "listMyItems").mockResolvedValue([CRIB]);
    renderPage();
    expect(screen.getByText("Loading…")).toBeInTheDocument();
    expect(await screen.findByRole("heading", { name: "Crib" })).toBeInTheDocument();
    expect(screen.getByText("2 left")).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "Edit" })).toHaveAttribute("href", ROUTES.editItem(7));
    expect(screen.getByRole("link", { name: "Post an item" })).toHaveAttribute("href", ROUTES.postItem);
  });

  it("shows a friendly empty screen", async () => {
    vi.spyOn(api, "listMyItems").mockResolvedValue([]);
    renderPage();
    expect(await screen.findByText(/You haven't posted anything yet/)).toBeInTheDocument();
  });

  it("says when the items couldn't load", async () => {
    vi.spyOn(api, "listMyItems").mockRejectedValue(new Error("Failed to fetch"));
    renderPage();
    expect(await screen.findByText("Your items couldn't load. Failed to fetch")).toBeInTheDocument();
  });

  it("asks Are you sure before taking an item down", async () => {
    vi.spyOn(api, "listMyItems").mockResolvedValue([CRIB]);
    const takeDown = vi.spyOn(api, "takeDownItem").mockResolvedValue(null);
    renderPage();
    fireEvent.click(await screen.findByRole("button", { name: "Take down" }));
    expect(screen.getByText("Are you sure? Families won't find Crib anymore.")).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "Keep it" }));
    expect(takeDown).not.toHaveBeenCalled();
    fireEvent.click(screen.getByRole("button", { name: "Take down" }));
    fireEvent.click(screen.getByRole("button", { name: "Yes, take down" }));
    expect(await screen.findByText(/You haven't posted anything yet/)).toBeInTheDocument();
    expect(takeDown).toHaveBeenCalledWith(7);
  });

  it("handles two take-downs at once", async () => {
    vi.spyOn(api, "listMyItems").mockResolvedValue([CRIB, { ...CRIB, id: 8, name: "Stroller" }]);
    let finishFirst;
    vi.spyOn(api, "takeDownItem")
      .mockImplementationOnce(() => new Promise((resolve) => (finishFirst = resolve)))
      .mockResolvedValueOnce(null);
    renderPage();
    for (const name of ["Crib", "Stroller"]) {
      await screen.findByRole("heading", { name });
    }
    for (const button of screen.getAllByRole("button", { name: "Take down" })) fireEvent.click(button);
    for (const button of screen.getAllByRole("button", { name: "Yes, take down" })) fireEvent.click(button);
    await screen.findByRole("heading", { name: "Crib" });
    finishFirst(null);
    expect(await screen.findByText(/You haven't posted anything yet/)).toBeInTheDocument();
  });

  it("keeps the item and says so when taking down fails", async () => {
    vi.spyOn(api, "listMyItems").mockResolvedValue([CRIB]);
    vi.spyOn(api, "takeDownItem").mockRejectedValue(new Error("Failed to fetch"));
    renderPage();
    fireEvent.click(await screen.findByRole("button", { name: "Take down" }));
    fireEvent.click(screen.getByRole("button", { name: "Yes, take down" }));
    expect(await screen.findByText("It wasn't taken down. Failed to fetch")).toBeInTheDocument();
    expect(screen.getByRole("heading", { name: "Crib" })).toBeInTheDocument();
  });

  it("says Saved after an edit", async () => {
    vi.spyOn(api, "listMyItems").mockResolvedValue([CRIB]);
    renderPage({ saved: "Crib" });
    expect(screen.getByText("Saved Crib.")).toBeInTheDocument();
    await screen.findByRole("heading", { name: "Crib" });
  });
});
