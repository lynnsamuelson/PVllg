import { fireEvent, render, screen } from "@testing-library/react";
import { MemoryRouter, Route, Routes, useLocation } from "react-router-dom";
import { afterEach, describe, expect, it, vi } from "vitest";
import * as api from "../../api/client.js";
import { ROUTES } from "../../routes.js";
import ResourceDetailPage, { siteName } from "./ResourceDetailPage.jsx";

const WIC = {
  id: 7, title: "Davidson County WIC", category: "Food & feeding support", area_type: "local",
  area_served: "Davidson County", summary: "Healthy food, nutrition help, breastfeeding support, and referrals.",
  who_we_serve: "Pregnant and new parents, babies, and children under 5, if they meet WIC rules.",
  age_text: "Pregnancy through age 4", limits: "Davidson County residents.",
  next_step: "Fill out the WIC Interest Form on the website, or call a clinic to set an appointment.",
  referral: "Appointment required.", url: "https://www.nashville.gov/departments/health/wic",
  source_url: "https://www.nashville.gov/departments/health/wic", last_checked: "2026-10-17",
  public_phone: "615-340-5619", public_email: "", public_address: "2500 Charlotte Avenue, Nashville, TN 37209",
  contact_note: "", description: "Longer notes.",
};

function Where() {
  const location = useLocation();
  return <p data-testid="where">{location.pathname + location.search}</p>;
}

function renderDetail(entries = [{ pathname: ROUTES.resource(7) }]) {
  render(
    <MemoryRouter initialEntries={entries} initialIndex={entries.length - 1} future={{ v7_startTransition: true, v7_relativeSplatPath: true }}>
      <Routes>
        <Route path={ROUTES.resource()} element={<ResourceDetailPage />} />
        <Route path={ROUTES.search} element={<Where />} />
      </Routes>
    </MemoryRouter>
  );
}

afterEach(() => vi.restoreAllMocks());

describe("ResourceDetailPage", () => {
  it("shows every fact from the program's page (Mock Up 22)", async () => {
    const get = vi.spyOn(api, "getResource").mockResolvedValue(WIC);
    renderDetail();
    expect(screen.getByRole("status")).toHaveTextContent("Loading");
    expect(await screen.findByRole("heading", { name: "Davidson County WIC" })).toBeInTheDocument();
    expect(get).toHaveBeenCalledWith("7");
    expect(screen.getByText(/Food & feeding support · Davidson County/)).toBeInTheDocument();
    expect(screen.getByText("Public listing")).toBeInTheDocument();
    expect(screen.getByText(WIC.summary)).toBeInTheDocument();
    expect(screen.getByText("Longer notes.")).toBeInTheDocument();
    expect(screen.getByRole("heading", { name: "Who may be a good fit" })).toBeInTheDocument();
    expect(screen.getByText(WIC.who_we_serve)).toBeInTheDocument();
    expect(screen.getByText("Ages: Pregnancy through age 4")).toBeInTheDocument();
    expect(screen.getByText(WIC.next_step)).toBeInTheDocument();
    expect(screen.getByText("Referral or appointment: Appointment required.")).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "nashville.gov ↗" })).toHaveAttribute("href", WIC.url);
    expect(screen.getByRole("link", { name: "615-340-5619" })).toHaveAttribute("href", "tel:6153405619");
    expect(screen.getByText(/2500 Charlotte Avenue, Nashville, TN 37209/)).toBeInTheDocument();
    expect(
      screen.getByText("Source: nashville.gov · last checked Oct 17, 2026. Please confirm before you go.")
    ).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Reach out Demo" })).toBeInTheDocument();
    expect(screen.queryByText(/qualify/i)).not.toBeInTheDocument();
  });

  it("says Not listed for anything the page doesn't list", async () => {
    vi.spyOn(api, "getResource").mockResolvedValue({
      ...WIC, description: "", area_type: "national", url: "", public_phone: "", public_address: "", referral: "", source_url: "",
      last_checked: null,
    });
    renderDetail();
    await screen.findByRole("heading", { name: "Davidson County WIC" });
    expect(screen.getByText(/· National/)).toBeInTheDocument();
    expect(screen.queryByText("Longer notes.")).not.toBeInTheDocument();
    expect(screen.getByText("Website: Not listed")).toBeInTheDocument();
    expect(screen.getByText("Public contact: Not listed")).toBeInTheDocument();
    expect(screen.getByText("Referral or appointment: Not listed")).toBeInTheDocument();
    expect(
      screen.getByText("Source: Not listed · last checked Not listed. Please confirm before you go.")
    ).toBeInTheDocument();
  });

  it("goes back to the results, or to the Resources tab when opened directly", async () => {
    vi.spyOn(api, "getResource").mockResolvedValue(WIC);
    renderDetail();
    fireEvent.click(await screen.findByRole("button", { name: "← Results" }));
    expect(screen.getByTestId("where")).toHaveTextContent("/search?tab=resources");
  });

  it("returns to the same search when Search opened it", async () => {
    vi.spyOn(api, "getResource").mockResolvedValue(WIC);
    renderDetail([`${ROUTES.search}?tab=resources&q=wic`, { pathname: ROUTES.resource(7), state: { fromList: true } }]);
    fireEvent.click(await screen.findByRole("button", { name: "← Results" }));
    expect(screen.getByTestId("where")).toHaveTextContent("/search?tab=resources&q=wic");
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

describe("siteName", () => {
  it("drops www and paths, and falls back to the text", () => {
    expect(siteName("https://www.tn.gov/tenncare/x.html")).toBe("tn.gov");
    expect(siteName("not a url")).toBe("not a url");
  });
});
