import { render, screen } from "@testing-library/react";
import { MemoryRouter, Route, Routes } from "react-router-dom";
import { afterEach, describe, expect, it, vi } from "vitest";
import * as api from "../../api/client.js";
import * as auth from "../../context/AuthContext.jsx";
import { ROUTES } from "../../routes.js";
import HomePage, { journeyLine } from "./HomePage.jsx";

const PROFILE = {
  zip: "37206", area: "Nashville / Davidson County", stage: "parenting", ages: ["3_12mo"], roles: ["parent"],
  needs: ["essentials", "feeding"], usage: "get",
};
const TAYLOR = { name: "Taylor Smith", account_type: "person", profile: PROFILE, gives: false };
const DIAPERS = {
  id: 1, name: "Size 1 diapers", giver: "Sample Community Closet", from_organization: true, distance_miles: 2, demo: true,
};
const WIC = {
  id: 6, title: "Davidson County WIC", category: "Food & feeding support", referral: "Appointment required.",
  matches_needs: true, reason: "Matches Feeding and your area",
};

function renderHome(user = TAYLOR) {
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

afterEach(() => vi.restoreAllMocks());

describe("journeyLine", () => {
  it("reads the stage and each child's age group", () => {
    expect(journeyLine(PROFILE)).toBe("Parenting, baby 3-12 months");
    expect(journeyLine({ stage: "both", ages: ["under_3mo", "3_5yrs"] })).toBe(
      "Expecting and parenting, baby under 3 months, child 3-5 years"
    );
    expect(journeyLine({ stage: "expecting", ages: [] })).toBe("Expecting");
  });
});

describe("HomePage", () => {
  it("is built from the person's own answers with two picks (Mock Up 11)", async () => {
    vi.spyOn(api, "searchItems").mockResolvedValue([DIAPERS]);
    const matches = vi.spyOn(api, "getResourceMatches").mockResolvedValue([WIC]);
    renderHome();
    expect(screen.getByRole("heading", { name: "Welcome, Taylor" })).toBeInTheDocument();
    expect(screen.getByText("Nashville / Davidson County")).toBeInTheDocument();
    expect(screen.getByText("Parenting, baby 3-12 months")).toBeInTheDocument();
    expect(screen.getByText("Diapers")).toBeInTheDocument();
    expect(screen.getByText("Feeding")).toBeInTheDocument();
    expect(await screen.findByRole("link", { name: /Size 1 diapers/ })).toHaveAttribute("href", ROUTES.item(1));
    expect(screen.getByText(/about 2 miles/)).toBeInTheDocument();
    expect(screen.getByText("Demo")).toBeInTheDocument();
    expect(screen.getByRole("link", { name: /Davidson County WIC/ })).toHaveAttribute("href", ROUTES.resource(6));
    expect(screen.getByText("Food & feeding support · Appointment required.")).toBeInTheDocument();
    expect(screen.getByText("Matches Feeding and your area")).toBeInTheDocument();
    expect(matches).toHaveBeenCalledWith(PROFILE);
    expect(screen.getByRole("link", { name: "Find resources" })).toHaveAttribute("href", `${ROUTES.search}?tab=resources`);
    expect(screen.getByRole("link", { name: "See items" })).toHaveAttribute("href", ROUTES.search);
    expect(screen.queryByRole("link", { name: "My items" })).not.toBeInTheDocument();
  });

  it("says Welcome without a name and shows My items to people who give", async () => {
    vi.spyOn(api, "searchItems").mockResolvedValue([]);
    vi.spyOn(api, "getResourceMatches").mockResolvedValue([]);
    renderHome({ ...TAYLOR, name: "", gives: true });
    expect(screen.getByRole("heading", { name: "Welcome" })).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "My items" })).toHaveAttribute("href", ROUTES.give);
    expect(await screen.findByText(/Nothing near you just yet/)).toBeInTheDocument();
  });

  it("keeps the resource pick when items fail, and skips resources that don't fit a need", async () => {
    vi.spyOn(api, "searchItems").mockRejectedValue(new Error("Failed to fetch"));
    vi.spyOn(api, "getResourceMatches").mockResolvedValue([{ ...WIC, id: 9, title: "Off-need class", matches_needs: false }, WIC]);
    renderHome();
    expect(await screen.findByRole("link", { name: /Davidson County WIC/ })).toBeInTheDocument();
    expect(screen.queryByText("Off-need class")).not.toBeInTheDocument();
  });

  it("leaves out picks and Search for people with Get support off", () => {
    const search = vi.spyOn(api, "searchItems");
    renderHome({ ...TAYLOR, gets: false, gives: true });
    expect(screen.queryByText("For you right now")).not.toBeInTheDocument();
    expect(screen.queryByRole("link", { name: "See items" })).not.toBeInTheDocument();
    expect(screen.getByRole("link", { name: "My items" })).toBeInTheDocument();
    expect(search).not.toHaveBeenCalled();
  });

  it("says when suggestions couldn't load", async () => {
    vi.spyOn(api, "searchItems").mockRejectedValue(new Error("Failed to fetch"));
    vi.spyOn(api, "getResourceMatches").mockRejectedValue(new Error("Failed to fetch"));
    renderHome();
    expect(screen.getByRole("status")).toHaveTextContent("Loading");
    expect(await screen.findByText("Suggestions couldn't load. Failed to fetch")).toBeInTheDocument();
  });

  it("asks a person without a profile to set one up", () => {
    const search = vi.spyOn(api, "searchItems");
    renderHome({ ...TAYLOR, profile: null });
    expect(screen.getByRole("link", { name: "Set up your profile" })).toHaveAttribute("href", ROUTES.profileSetup);
    expect(search).not.toHaveBeenCalled();
  });

  it("sends organizations to their Items tab", () => {
    renderHome({ name: "Closet", account_type: "organization" });
    expect(screen.getByText("My items")).toBeInTheDocument();
  });
});
