import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { afterEach, describe, expect, it, vi } from "vitest";
import * as api from "../../api/client.js";
import { ROUTES } from "../../routes.js";
import MyItemsPage, { countsLine } from "./MyItemsPage.jsx";

const CRIB = { id: 7, name: "Crib", quantity: 2, left: 2, requested: 0, claimed: 0, claims: [] };
const BUNDLE = {
  id: 8, name: "Baby clothes bundle", quantity: 1, left: 0, requested: 1, claimed: 0,
  claims: [{ id: 30, status: "waiting", family: "Taylor" }],
};
const STROLLER = {
  id: 9, name: "Stroller", quantity: 1, left: 0, requested: 0, claimed: 1,
  claims: [{ id: 31, status: "approved", family: "Jordan" }],
};

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
    expect(countsLine({ quantity: 1, left: 0, requested: 1, claimed: 0 })).toBe("1 listed · 1 requested");
    expect(countsLine({ quantity: 3, left: 1, requested: 1, claimed: 1 })).toBe("3 listed · 1 requested · 1 claimed · 1 left");
    expect(countsLine({ quantity: 1, left: -1, requested: 0, claimed: 1 })).toBe("0 left · 1 claimed");
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

  it("shows a request with the family's first name, and Approve reloads the list", async () => {
    const list = vi.spyOn(api, "listMyItems").mockResolvedValueOnce([BUNDLE]).mockResolvedValueOnce([
      { ...BUNDLE, requested: 0, claimed: 1, claims: [{ id: 30, status: "approved", family: "Taylor" }] },
    ]);
    const approve = vi.spyOn(api, "approveClaim").mockResolvedValue({ id: 30, status: "approved" });
    renderPage();
    expect(await screen.findByText("Taylor")).toBeInTheDocument();
    expect(screen.getByText("1 listed · 1 requested")).toBeInTheDocument();
    expect(screen.getByText("Approving shares your exact pickup details.")).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "Approve" }));
    expect(await screen.findByText("Approved for Taylor")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Mark picked up" })).toBeEnabled();
    expect(screen.queryByRole("button", { name: "Take down" })).not.toBeInTheDocument();
    expect(approve).toHaveBeenCalledWith(30);
    expect(list).toHaveBeenCalledTimes(2);
  });

  it("declines a request", async () => {
    vi.spyOn(api, "listMyItems").mockResolvedValueOnce([BUNDLE]).mockResolvedValueOnce([{ ...BUNDLE, claims: [] }]);
    const decline = vi.spyOn(api, "declineClaim").mockResolvedValue({ id: 30, status: "declined" });
    renderPage();
    fireEvent.click(await screen.findByRole("button", { name: "Decline" }));
    await waitFor(() => expect(screen.queryByText("Taylor")).not.toBeInTheDocument());
    expect(decline).toHaveBeenCalledWith(30);
  });

  it("ends an approved claim when the family didn't come", async () => {
    vi.spyOn(api, "listMyItems").mockResolvedValueOnce([STROLLER]).mockResolvedValueOnce([
      { ...STROLLER, claimed: 0, left: 1, claims: [] },
    ]);
    const didntCome = vi.spyOn(api, "familyDidntCome").mockResolvedValue({ id: 31, status: "ended" });
    renderPage();
    fireEvent.click(await screen.findByRole("button", { name: "Family didn't come" }));
    fireEvent.click(screen.getByRole("button", { name: "Keep it" }));
    expect(didntCome).not.toHaveBeenCalled();
    fireEvent.click(screen.getByRole("button", { name: "Family didn't come" }));
    fireEvent.click(screen.getByRole("button", { name: "Yes, they didn't come" }));
    expect(await screen.findByText("1 left")).toBeInTheDocument();
    expect(didntCome).toHaveBeenCalledWith(31);
  });

  it("marks an approved claim picked up, and says when an answer fails", async () => {
    vi.spyOn(api, "listMyItems").mockResolvedValue([STROLLER]);
    vi.spyOn(api, "markPickedUp").mockRejectedValue(new Error("This claim isn't approved."));
    renderPage();
    expect(await screen.findByText("0 left · 1 claimed")).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "Mark picked up" }));
    expect(await screen.findByText("This claim isn't approved.")).toBeInTheDocument();
  });

  it("shows a paused item with the reason, and puts it back", async () => {
    vi.spyOn(api, "listMyItems").mockResolvedValueOnce([{ ...CRIB, paused: "The item wasn't there" }]).mockResolvedValueOnce([CRIB]);
    const available = vi.spyOn(api, "markAvailable").mockResolvedValue(CRIB);
    renderPage();
    expect(await screen.findByText(/A family reported: "The item wasn't there."/)).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "Yes, it is available" }));
    await waitFor(() => expect(screen.queryByText(/Paused/)).not.toBeInTheDocument());
    expect(available).toHaveBeenCalledWith(7);
  });

  it("says when putting a paused item back fails", async () => {
    vi.spyOn(api, "listMyItems").mockResolvedValue([{ ...CRIB, paused: "Something else" }]);
    vi.spyOn(api, "markAvailable").mockRejectedValue(new Error("Failed to fetch"));
    renderPage();
    fireEvent.click(await screen.findByRole("button", { name: "Yes, it is available" }));
    expect(await screen.findByText("Failed to fetch")).toBeInTheDocument();
  });

  it("says Saved after an edit", async () => {
    vi.spyOn(api, "listMyItems").mockResolvedValue([CRIB]);
    renderPage({ saved: "Crib" });
    expect(screen.getByText("Saved Crib.")).toBeInTheDocument();
    await screen.findByRole("heading", { name: "Crib" });
  });
});
