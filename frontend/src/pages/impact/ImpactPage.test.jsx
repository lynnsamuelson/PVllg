import { render, screen } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { afterEach, describe, expect, it, vi } from "vitest";
import * as api from "../../api/client.js";
import * as auth from "../../context/AuthContext.jsx";
import ImpactPage from "./ImpactPage.jsx";

const NUMBERS = {
  organization: "Sample Community Closet", demo: true, families_helped: 18, items_posted: 42, items_claimed: 30,
  items_picked_up: 24, returned_to_list: 6, estimated_savings: 1620,
};

function renderPage(user = { account_type: "organization" }) {
  vi.spyOn(auth, "useAuth").mockReturnValue({ user });
  render(
    <MemoryRouter future={{ v7_startTransition: true, v7_relativeSplatPath: true }}>
      <ImpactPage />
    </MemoryRouter>
  );
}

afterEach(() => vi.restoreAllMocks());

describe("ImpactPage", () => {
  it("shows the six numbers for the last 30 days (Mock Up 10)", async () => {
    vi.spyOn(api, "getImpact").mockResolvedValue(NUMBERS);
    renderPage();
    expect(screen.getByRole("status")).toHaveTextContent("Loading");
    expect(await screen.findByText("Sample Community Closet, last 30 days")).toBeInTheDocument();
    expect(screen.getByText("Example data")).toBeInTheDocument();
    expect(screen.getAllByRole("listitem").map((li) => li.textContent)).toEqual([
      "18Families helped", "42Items posted", "30Items claimed", "24Items picked up", "6Returned to the list",
      "$1,620Estimated savings",
    ]);
    expect(screen.getByText(/A family counts once, after pickup is confirmed/)).toBeInTheDocument();
  });

  it("leaves off Example data for real numbers", async () => {
    vi.spyOn(api, "getImpact").mockResolvedValue({ ...NUMBERS, demo: false });
    renderPage();
    await screen.findByText("Sample Community Closet, last 30 days");
    expect(screen.queryByText("Example data")).not.toBeInTheDocument();
  });

  it("explains an empty month", async () => {
    const zeros = Object.fromEntries(Object.keys(NUMBERS).map((k) => [k, 0]));
    vi.spyOn(api, "getImpact").mockResolvedValue({ ...zeros, organization: "New Org", demo: false });
    renderPage();
    expect(await screen.findByText(/Nothing yet in the last 30 days/)).toBeInTheDocument();
  });

  it("says when the numbers couldn't load", async () => {
    vi.spyOn(api, "getImpact").mockRejectedValue(new Error("Failed to fetch"));
    renderPage();
    expect(await screen.findByText("Your impact numbers couldn't load. Failed to fetch")).toBeInTheDocument();
  });
});
