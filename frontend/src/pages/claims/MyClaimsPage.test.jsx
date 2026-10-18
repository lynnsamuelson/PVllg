import { fireEvent, render, screen } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { afterEach, describe, expect, it, vi } from "vitest";
import * as api from "../../api/client.js";
import * as auth from "../../context/AuthContext.jsx";
import { ROUTES } from "../../routes.js";
import MyClaimsPage, { holdLine, pastReason } from "./MyClaimsPage.jsx";

const IN_3_DAYS = new Date(Date.now() + 3 * 24 * 60 * 60 * 1000 - 60000).toISOString();
const ITEM = {
  name: "Size 1 diapers", pickup_date: "2030-10-22", pickup_start: "10:00:00", pickup_end: "14:00:00",
  general_area: "East Nashville", exact_address: "100 Sample Way, Nashville, TN 37206", where_to_go: "Front desk.",
};
const APPROVED = { id: 1, status: "approved", held_until: IN_3_DAYS, item: ITEM };
const WAITING = {
  id: 2, status: "waiting", held_until: IN_3_DAYS,
  item: { ...ITEM, name: "Baby clothes bundle", exact_address: null, where_to_go: null },
};

function renderPage(entry = ROUTES.claims, user = { account_type: "person" }) {
  vi.spyOn(auth, "useAuth").mockReturnValue({ user });
  render(
    <MemoryRouter initialEntries={[entry]} future={{ v7_startTransition: true, v7_relativeSplatPath: true }}>
      <MyClaimsPage />
    </MemoryRouter>
  );
}

afterEach(() => vi.restoreAllMocks());

describe("holdLine", () => {
  it("counts whole days left", () => {
    const now = new Date("2030-10-20T12:00:00Z");
    expect(holdLine("2030-10-23T11:00:00Z", now)).toBe("Hold ends in 3 days");
    expect(holdLine("2030-10-21T14:00:00Z", now)).toBe("Hold ends in 1 day");
    expect(holdLine("2030-10-20T14:00:00Z", now)).toBe("Hold ends today");
    expect(holdLine("2030-10-20T11:00:00Z", now)).toBe("Hold has ended");
  });
});

describe("pastReason", () => {
  it("says why each claim ended", () => {
    expect(pastReason({ status: "ended", end_reason: "hold_ended" })).toBe("The hold ended.");
    expect(pastReason({ status: "ended", end_reason: "no_answer" })).toBe("The giver didn't answer in time.");
    expect(pastReason({ status: "ended", end_reason: "no_show" })).toBe("The giver marked it not picked up.");
    expect(pastReason({ status: "ended", end_reason: "constructor" })).toBe("This claim ended.");
    expect(pastReason({ status: "declined" })).toBe("The giver declined.");
    expect(pastReason({ status: "canceled" })).toBeNull();
    expect(pastReason({ status: "picked_up" })).toBeNull();
  });
});

describe("MyClaimsPage", () => {
  it("shows Approved with the place and Waiting without it (Mock Up 15)", async () => {
    vi.spyOn(api, "listClaims").mockResolvedValue([APPROVED, WAITING]);
    renderPage();
    expect(screen.getByRole("status")).toHaveTextContent("Loading");
    expect(await screen.findByText("Approved")).toBeInTheDocument();
    expect(screen.getAllByText("Hold ends in 3 days")).toHaveLength(2);
    expect(screen.getByText("Tue, Oct 22 · 10 am - 2 pm")).toBeInTheDocument();
    expect(screen.getByText("100 Sample Way, Nashville, TN 37206")).toBeInTheDocument();
    expect(screen.getByText("Waiting")).toBeInTheDocument();
    expect(
      screen.getByText("The giver hasn't answered yet. Exact pickup details appear after approval.")
    ).toBeInTheDocument();
    expect(screen.getByText(/the item goes back on the list for other families/)).toBeInTheDocument();
    expect(screen.getAllByRole("button", { name: "Cancel claim" })).toHaveLength(2);
    expect(screen.getByRole("link", { name: "Add to calendar" })).toHaveAttribute("href", ROUTES.claimCalendar(1));
    expect(api.listClaims).toHaveBeenCalledWith("active");
  });

  it("says when the giver changed the pickup details", async () => {
    vi.spyOn(api, "listClaims").mockResolvedValue([{ ...APPROVED, pickup_changed: true }]);
    renderPage();
    expect(await screen.findByText("Pickup details changed. Update your calendar.")).toBeInTheDocument();
  });

  it("leaves out the hold line when a claim has no hold date", async () => {
    vi.spyOn(api, "listClaims").mockResolvedValue([{ ...APPROVED, held_until: null }]);
    renderPage();
    await screen.findByText("Approved");
    expect(screen.queryByText(/Hold/)).not.toBeInTheDocument();
  });

  it("cancels after asking, and the claim leaves Active", async () => {
    vi.spyOn(api, "listClaims").mockResolvedValue([APPROVED]);
    const cancel = vi.spyOn(api, "cancelClaim").mockResolvedValue({ ...APPROVED, status: "canceled" });
    renderPage();
    fireEvent.click(await screen.findByRole("button", { name: "Cancel claim" }));
    fireEvent.click(screen.getByRole("button", { name: "Keep it" }));
    expect(cancel).not.toHaveBeenCalled();
    fireEvent.click(screen.getByRole("button", { name: "Cancel claim" }));
    fireEvent.click(screen.getByRole("button", { name: "Yes, cancel" }));
    expect(await screen.findByText(/You have no claims right now/)).toBeInTheDocument();
    expect(cancel).toHaveBeenCalledWith(1);
  });

  it("keeps the claim and says so when canceling fails", async () => {
    vi.spyOn(api, "listClaims").mockResolvedValue([APPROVED]);
    vi.spyOn(api, "cancelClaim").mockRejectedValue(new Error("This claim has already ended."));
    renderPage();
    fireEvent.click(await screen.findByRole("button", { name: "Cancel claim" }));
    fireEvent.click(screen.getByRole("button", { name: "Yes, cancel" }));
    expect(await screen.findByText("Your claim wasn't canceled. This claim has already ended.")).toBeInTheDocument();
  });

  it("shows ended claims under Past, without buttons", async () => {
    vi.spyOn(api, "listClaims").mockResolvedValue([{ ...APPROVED, status: "canceled" }]);
    renderPage(`${ROUTES.claims}?tab=past`);
    expect(await screen.findByText("Canceled")).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Cancel claim" })).not.toBeInTheDocument();
    expect(api.listClaims).toHaveBeenCalledWith("past");
    expect(screen.getByRole("tab", { name: "Past" })).toHaveAttribute("aria-selected", "true");
  });

  it("switches tabs", async () => {
    vi.spyOn(api, "listClaims").mockResolvedValue([]);
    renderPage();
    expect(await screen.findByRole("link", { name: "Search near me" })).toHaveAttribute("href", ROUTES.search);
    fireEvent.click(screen.getByRole("tab", { name: "Past" }));
    expect(await screen.findByText("Claims you finish or cancel show here.")).toBeInTheDocument();
  });

  it("says when claims couldn't load", async () => {
    vi.spyOn(api, "listClaims").mockRejectedValue(new Error("Failed to fetch"));
    renderPage();
    expect(await screen.findByText("Your claims couldn't load. Failed to fetch")).toBeInTheDocument();
  });

  it("points organizations to My items", () => {
    const list = vi.spyOn(api, "listClaims");
    renderPage(ROUTES.claims, { account_type: "organization" });
    expect(screen.getByRole("link", { name: "My items" })).toHaveAttribute("href", ROUTES.orgItems);
    expect(list).not.toHaveBeenCalled();
  });
});
