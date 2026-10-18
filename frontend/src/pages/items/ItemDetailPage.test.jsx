import { fireEvent, render, screen } from "@testing-library/react";
import { MemoryRouter, Route, Routes } from "react-router-dom";
import { afterEach, describe, expect, it, vi } from "vitest";
import * as api from "../../api/client.js";
import * as auth from "../../context/AuthContext.jsx";
import { ApiError } from "../../api/client.js";
import { ROUTES } from "../../routes.js";
import ItemDetailPage from "./ItemDetailPage.jsx";

const BASE = {
  id: 1, details: "Pack of 30. New, unopened.", pickup_date: "2030-10-22", pickup_start: "10:00:00",
  pickup_end: "14:00:00", what_to_bring: "Bring a bag.", photos: [], demo: false, available: true, mine: false,
};
const ORG_ITEM = {
  ...BASE, name: "Size 1 diapers", quantity: 12, left: 12, giver: "Sample Community Closet", from_organization: true,
  general_area: "East Nashville", distance_miles: 1, exact_address: "100 Sample Way, Nashville, TN 37206",
  where_to_go: "Ask for the Baby Closet.", private_note: null,
};
const PERSON_ITEM = {
  ...BASE, name: "Baby clothes bundle", quantity: 1, left: 1, giver: "A parent nearby", from_organization: false,
  general_area: "East Nashville", distance_miles: 3, exact_address: null, where_to_go: null,
  private_note: "Private. The exact pickup place is shared only after the giver approves your request.",
  photos: ["/api/items/photos/4/"],
};

const FROM_SEARCH = [ROUTES.search, { pathname: ROUTES.item(1), state: { fromList: true } }];

function renderPage(item, entries = FROM_SEARCH, user = { account_type: "person" }) {
  vi.spyOn(auth, "useAuth").mockReturnValue({ user });
  vi.spyOn(api, "getItem").mockImplementation(() => (item instanceof Error ? Promise.reject(item) : Promise.resolve(item)));
  render(
    <MemoryRouter initialEntries={entries} initialIndex={entries.length - 1} future={{ v7_startTransition: true, v7_relativeSplatPath: true }}>
      <Routes>
        <Route path={ROUTES.item()} element={<ItemDetailPage />} />
        <Route path={ROUTES.search} element={<p>Search results</p>} />
        <Route path={ROUTES.claims} element={<p>My claims page</p>} />
      </Routes>
    </MemoryRouter>
  );
}

afterEach(() => vi.restoreAllMocks());

describe("ItemDetailPage", () => {
  it("shows an organization's item with its public address (Mock Up 13)", async () => {
    renderPage(ORG_ITEM);
    expect(screen.getByRole("status")).toHaveTextContent("Loading");
    expect(await screen.findByRole("heading", { name: "Size 1 diapers" })).toBeInTheDocument();
    expect(screen.getByText("Verified")).toBeInTheDocument();
    expect(screen.getByRole("heading", { name: "12 left" })).toBeInTheDocument();
    expect(screen.getByText("Giver confirmed: good condition, not recalled")).toBeInTheDocument();
    expect(screen.getByText("Tue, Oct 22 · 10 am - 2 pm")).toBeInTheDocument();
    expect(screen.getByText("100 Sample Way, Nashville, TN 37206 (organization address)")).toBeInTheDocument();
    expect(screen.getByText("Ask for the Baby Closet.")).toBeInTheDocument();
    expect(screen.getByText("Bring a bag.")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Claim one (held for 3 days)" })).toBeEnabled();
    expect(screen.getByRole("button", { name: "Report a problem" })).toBeInTheDocument();
    expect(api.getItem).toHaveBeenCalledWith("1");
  });

  it("shows a person's item with no name, address or exact distance (Mock Up 14)", async () => {
    renderPage(PERSON_ITEM);
    expect(await screen.findByRole("heading", { name: "Baby clothes bundle" })).toBeInTheDocument();
    expect(screen.getByText(/A parent nearby/)).toBeInTheDocument();
    expect(screen.getByText("Private.").tagName).toBe("STRONG");
    expect(screen.getByText("Person")).toBeInTheDocument();
    expect(screen.getByRole("heading", { name: "Pickup window" })).toBeInTheDocument();
    expect(screen.getByText("East Nashville · about 3 miles")).toBeInTheDocument();
    expect(screen.getByText(/The exact pickup place is shared only after the giver approves your request/)).toBeInTheDocument();
    expect(screen.getByRole("img", { name: "Baby clothes bundle, photo 1" })).toHaveAttribute("src", "/api/items/photos/4/");
    expect(screen.getByRole("button", { name: "Request to claim" })).toBeEnabled();
  });

  it("claims and goes to My claims", async () => {
    const claim = vi.spyOn(api, "claimItem").mockResolvedValue({ id: 9, status: "approved" });
    renderPage(ORG_ITEM);
    fireEvent.click(await screen.findByRole("button", { name: "Claim one (held for 3 days)" }));
    expect(await screen.findByText("My claims page")).toBeInTheDocument();
    expect(claim).toHaveBeenCalledWith(1);
  });

  it("says why a claim failed and shows what's left now", async () => {
    vi.spyOn(api, "claimItem").mockRejectedValue(new ApiError("Someone just claimed the last one.", {}, 409));
    renderPage(PERSON_ITEM);
    await screen.findByRole("heading", { name: "Baby clothes bundle" });
    api.getItem.mockResolvedValueOnce({ ...PERSON_ITEM, left: 0, available: false });
    fireEvent.click(await screen.findByRole("button", { name: "Request to claim" }));
    expect(await screen.findByText("Someone just claimed the last one.")).toBeInTheDocument();
    expect(await screen.findByRole("heading", { name: "Not available" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Request to claim" })).toBeDisabled();
  });

  it("doesn't offer organizations a claim button", async () => {
    renderPage(ORG_ITEM, FROM_SEARCH, { account_type: "organization" });
    await screen.findByRole("heading", { name: "Size 1 diapers" });
    expect(screen.queryByRole("button", { name: /Claim/ })).not.toBeInTheDocument();
  });

  it("turns the button off when it can't be claimed anymore", async () => {
    renderPage({ ...ORG_ITEM, quantity: 0, available: false });
    expect(await screen.findByRole("heading", { name: "Not available" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Claim one (held for 3 days)" })).toBeDisabled();
  });

  it("goes back to the results", async () => {
    renderPage(ORG_ITEM);
    await screen.findByRole("heading", { name: "Size 1 diapers" });
    fireEvent.click(screen.getByRole("button", { name: "← Results" }));
    expect(screen.getByText("Search results")).toBeInTheDocument();
  });

  it("shows the giver their own item with Edit instead of Claim", async () => {
    renderPage({ ...ORG_ITEM, mine: true });
    expect(await screen.findByRole("link", { name: "This is your item. Edit it" })).toHaveAttribute("href", ROUTES.editItem(1));
    expect(screen.queryByRole("button", { name: /Claim/ })).not.toBeInTheDocument();
  });

  it("goes to Search when not opened from it (a shared link, or after signing in)", async () => {
    renderPage(ORG_ITEM, ["/welcome", ROUTES.item(1)]);
    await screen.findByRole("heading", { name: "Size 1 diapers" });
    fireEvent.click(screen.getByRole("button", { name: "← Results" }));
    expect(screen.getByText("Search results")).toBeInTheDocument();
  });

  it("says when the item is gone or couldn't load", async () => {
    renderPage(new ApiError("Not found.", {}, 404));
    expect(await screen.findByText("This item isn't available anymore.")).toBeInTheDocument();
  });

  it("shows other load errors as they are", async () => {
    renderPage(new Error("Failed to fetch"));
    expect(await screen.findByText("Failed to fetch")).toBeInTheDocument();
  });
});
