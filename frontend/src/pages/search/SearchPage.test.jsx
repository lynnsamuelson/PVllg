import { act, fireEvent, render, screen } from "@testing-library/react";
import { Link, MemoryRouter, Route, Routes, useLocation } from "react-router-dom";
import { afterEach, describe, expect, it, vi } from "vitest";
import * as api from "../../api/client.js";
import * as auth from "../../context/AuthContext.jsx";
import { ROUTES } from "../../routes.js";
import SearchPage from "./SearchPage.jsx";

const PROFILE = { zip: "37206", stage: "parenting", ages: ["3_12mo"], roles: [], needs: ["essentials"] };
const CLOSET_DIAPERS = {
  id: 1, name: "Size 1 diapers", giver: "Sample Community Closet", from_organization: true, demo: true,
  distance_miles: 1, quantity: 12, left: 12,
};
const CASEY_BUNDLE = {
  id: 2, name: "Baby clothes bundle", giver: "A parent nearby", from_organization: false, demo: false, distance_miles: 4,
  quantity: 1, left: 1,
};

function Where() {
  const location = useLocation();
  return (
    <>
      <p data-testid="where">{location.pathname + location.search}</p>
      <Link to={ROUTES.search}>Search tab</Link>
    </>
  );
}

function renderPage(entry = ROUTES.search, profile = PROFILE) {
  vi.spyOn(auth, "useAuth").mockReturnValue({ user: { account_type: "person", profile } });
  render(
    <MemoryRouter initialEntries={[entry]} future={{ v7_startTransition: true, v7_relativeSplatPath: true }}>
      <Routes>
        <Route path={ROUTES.search} element={<><SearchPage /><Where /></>} />
      </Routes>
    </MemoryRouter>
  );
}

afterEach(() => {
  vi.restoreAllMocks();
  vi.useRealTimers();
});

describe("SearchPage", () => {
  it("shows item cards nearest first with badges and never a person's name", async () => {
    vi.spyOn(api, "searchItems").mockResolvedValue([CLOSET_DIAPERS, CASEY_BUNDLE]);
    renderPage();
    expect(screen.getByRole("status")).toHaveTextContent("Searching near 37206");
    expect(await screen.findByRole("heading", { name: "Size 1 diapers" })).toBeInTheDocument();
    expect(screen.getByText("About 1 mile · 12 left")).toBeInTheDocument();
    expect(screen.getByText("Verified")).toBeInTheDocument();
    expect(screen.getByText("Demo")).toBeInTheDocument();
    expect(screen.getByText("Person")).toBeInTheDocument();
    expect(screen.getByText(/A parent nearby/)).toBeInTheDocument();
    expect(screen.getByRole("link", { name: /Size 1 diapers/ })).toHaveAttribute("href", ROUTES.item(1));
    expect(api.searchItems).toHaveBeenCalledWith({ q: "", category: "", radius: "10" });
  });

  it("puts typing, chips, tab and distance in the URL and searches again", async () => {
    vi.useFakeTimers({ shouldAdvanceTime: true });
    const search = vi.spyOn(api, "searchItems").mockResolvedValue([]);
    renderPage();
    fireEvent.change(screen.getByLabelText("Search"), { target: { value: "diapers" } });
    await act(() => vi.advanceTimersByTimeAsync(350));
    expect(search).toHaveBeenLastCalledWith({ q: "diapers", category: "", radius: "10" });
    fireEvent.click(screen.getByRole("radio", { name: "Feeding" }));
    fireEvent.change(screen.getByRole("combobox"), { target: { value: "25" } });
    expect(screen.getByTestId("where")).toHaveTextContent("q=diapers&category=feeding&radius=25");
    await screen.findByText("Nothing found within 25 miles. Try a wider distance or fewer filters.");
    expect(search).toHaveBeenLastCalledWith({ q: "diapers", category: "feeding", radius: "25" });
  });

  it("starts from the URL, so Back from details keeps the search", async () => {
    vi.spyOn(api, "getResourceMatches").mockResolvedValue([
      { id: 5, title: "TennCare Diaper Benefit", category: "Diapers", area_type: "statewide", limits: "Under 2", reason: "May be a good fit" },
      { id: 6, title: "Davidson County WIC", category: "Food", area_type: "local", distance_miles: 3, limits: "" },
      { id: 7, title: "Nashville Diaper Connection", category: "Diapers", area_type: "local", distance_miles: null, area_served: "Nashville area" },
    ]);
    renderPage(`${ROUTES.search}?tab=resources&q=wic&category=feeding&radius=50`);
    expect(screen.getByLabelText("Search")).toHaveValue("wic");
    expect(screen.getByRole("tab", { name: "Resources" })).toHaveAttribute("aria-selected", "true");
    expect(screen.getByRole("radio", { name: "Feeding" })).toHaveAttribute("aria-checked", "true");
    expect(await screen.findByText("Diapers · Statewide")).toBeInTheDocument();
    expect(screen.getByText("Food · About 3 miles")).toBeInTheDocument();
    expect(screen.getByText("May be a good fit")).toBeInTheDocument();
    expect(screen.getByText("Diapers · Nashville area")).toBeInTheDocument();
    expect(api.getResourceMatches).toHaveBeenCalledWith(PROFILE, { q: "wic", category: "feeding", radius: "50" });
  });

  it("sends Housing on the Items tab to Resources without searching items", async () => {
    const search = vi.spyOn(api, "searchItems").mockResolvedValue([]);
    vi.spyOn(api, "getResourceMatches").mockResolvedValue([]);
    renderPage(`${ROUTES.search}?category=housing`);
    expect(screen.getByText("Housing help is listed under Resources.")).toBeInTheDocument();
    expect(search).not.toHaveBeenCalled();
    fireEvent.click(screen.getByRole("button", { name: "See housing resources" }));
    expect(screen.getByRole("tab", { name: "Resources" })).toHaveAttribute("aria-selected", "true");
    await screen.findByText(/Nothing found/);
    expect(api.getResourceMatches).toHaveBeenCalledWith(PROFILE, { q: "", category: "housing", radius: "10" });
  });

  it("doesn't show one tab's results on the other while loading", async () => {
    vi.spyOn(api, "searchItems").mockResolvedValue([CLOSET_DIAPERS]);
    vi.spyOn(api, "getResourceMatches").mockReturnValue(new Promise(() => {}));
    renderPage();
    await screen.findByRole("heading", { name: "Size 1 diapers" });
    fireEvent.click(screen.getByRole("tab", { name: "Resources" }));
    expect(screen.queryByRole("heading", { name: "Size 1 diapers" })).not.toBeInTheDocument();
    expect(screen.getByRole("status")).toHaveTextContent("Searching");
  });

  it("shows the URL's words when the URL changes, and a local resource is at least 1 mile", async () => {
    vi.spyOn(api, "getResourceMatches").mockResolvedValue([
      { id: 6, title: "Davidson County WIC", category: "Food", area_type: "local", distance_miles: 0, limits: "" },
    ]);
    renderPage(`${ROUTES.search}?tab=resources&q=wic`);
    expect(await screen.findByText("Food · About 1 mile")).toBeInTheDocument();
    expect(screen.getByLabelText("Search")).toHaveValue("wic");
    vi.spyOn(api, "searchItems").mockResolvedValue([]);
    fireEvent.click(screen.getByRole("link", { name: "Search tab" }));
    expect(screen.getByLabelText("Search")).toHaveValue("");
  });

  it("tells organizations search is for families", () => {
    const search = vi.spyOn(api, "searchItems");
    vi.spyOn(auth, "useAuth").mockReturnValue({ user: { account_type: "organization", profile: null } });
    render(
      <MemoryRouter future={{ v7_startTransition: true, v7_relativeSplatPath: true }}>
        <SearchPage />
      </MemoryRouter>
    );
    expect(screen.getByText(/Search near me is for families/)).toBeInTheDocument();
    expect(search).not.toHaveBeenCalled();
  });

  it("ignores values that aren't on the list", async () => {
    vi.spyOn(api, "searchItems").mockResolvedValue([]);
    renderPage(`${ROUTES.search}?tab=constructor&category=__proto__&radius=7`);
    await screen.findByText(/Nothing found within 10 miles/);
    expect(api.searchItems).toHaveBeenCalledWith({ q: "", category: "", radius: "10" });
  });

  it("offers a wider distance when nothing is found", async () => {
    const search = vi.spyOn(api, "searchItems").mockResolvedValue([]);
    renderPage();
    fireEvent.click(await screen.findByRole("button", { name: "Search within 25 miles" }));
    expect(search).toHaveBeenLastCalledWith({ q: "", category: "", radius: "25" });
  });

  it("says when search couldn't load and tries again", async () => {
    const search = vi.spyOn(api, "searchItems").mockRejectedValueOnce(new Error("Failed to fetch")).mockResolvedValue([CLOSET_DIAPERS]);
    renderPage();
    expect(await screen.findByText("Search couldn't load. Failed to fetch")).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "Try again" }));
    expect(await screen.findByRole("heading", { name: "Size 1 diapers" })).toBeInTheDocument();
    expect(search).toHaveBeenCalledTimes(2);
  });

  it("asks for a ZIP code before searching", () => {
    const search = vi.spyOn(api, "searchItems");
    renderPage(ROUTES.search, null);
    expect(screen.getByText(/Add your ZIP code to search near you/)).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "Set up your profile" })).toHaveAttribute("href", ROUTES.profileSetup);
    expect(search).not.toHaveBeenCalled();
  });
});
