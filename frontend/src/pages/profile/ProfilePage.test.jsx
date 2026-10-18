import { fireEvent, render, screen } from "@testing-library/react";
import { MemoryRouter, Route, Routes } from "react-router-dom";
import { afterEach, describe, expect, it, vi } from "vitest";
import * as api from "../../api/client.js";
import { ApiError } from "../../api/client.js";
import * as auth from "../../context/AuthContext.jsx";
import { ROUTES } from "../../routes.js";
import ProfilePage from "./ProfilePage.jsx";

const PROFILE = {
  zip: "37206", stage: "parenting", arrival_month: "", ages: ["3_12mo"], roles: ["parent"], needs: ["essentials"],
  usage: "get",
};

function renderPage(user = { account_type: "person", name: "Taylor", profile: PROFILE }) {
  const updateUser = vi.fn();
  const logout = vi.fn().mockResolvedValue();
  vi.spyOn(auth, "useAuth").mockReturnValue({ user, updateUser, logout });
  render(
    <MemoryRouter initialEntries={[ROUTES.profile]} future={{ v7_startTransition: true, v7_relativeSplatPath: true }}>
      <Routes>
        <Route path={ROUTES.profile} element={<ProfilePage />} />
        <Route path={ROUTES.welcome} element={<p>Welcome screen</p>} />
      </Routes>
    </MemoryRouter>
  );
  return { updateUser, logout };
}

const toggle = (name) => fireEvent.click(screen.getByRole("switch", { name }));
const save = () => fireEvent.click(screen.getByRole("button", { name: "Save changes" }));

afterEach(() => vi.restoreAllMocks());

describe("ProfilePage (person)", () => {
  it("shows the switches and each answer with Edit (Mock Up 25)", () => {
    renderPage();
    expect(screen.getByRole("switch", { name: "Get support" })).toBeChecked();
    expect(screen.getByRole("switch", { name: "Give support" })).not.toBeChecked();
    expect(screen.getByText("Turn either on or off any time. Your claims and items are kept.")).toBeInTheDocument();
    expect(screen.getByText("ZIP 37206")).toBeInTheDocument();
    expect(screen.getByText("Parenting")).toBeInTheDocument();
    expect(screen.getByText("3-12 mo")).toBeInTheDocument();
    expect(screen.getByText("Diapers & everyday essentials")).toBeInTheDocument();
    expect(screen.getAllByRole("button", { name: /^Edit/ })).toHaveLength(5);
  });

  it("edits an answer on the same question screen, then saves", async () => {
    const saved = { account_type: "person", profile: { ...PROFILE, zip: "37208" } };
    const spy = vi.spyOn(api, "savePersonProfile").mockResolvedValue(saved);
    const { updateUser } = renderPage();
    fireEvent.click(screen.getByRole("button", { name: "Edit Area" }));
    expect(screen.getByRole("heading", { name: "Where are you in your journey?" })).toBeInTheDocument();
    fireEvent.change(screen.getByLabelText("ZIP code (required)"), { target: { value: "372" } });
    fireEvent.click(screen.getByRole("button", { name: "Done" }));
    expect(screen.getByText("Enter your 5-digit ZIP code.")).toBeInTheDocument();
    fireEvent.change(screen.getByLabelText("ZIP code (required)"), { target: { value: "37208" } });
    fireEvent.click(screen.getByRole("button", { name: "Done" }));
    expect(screen.getByText("ZIP 37208")).toBeInTheDocument();
    save();
    expect(await screen.findByText("Saved")).toBeInTheDocument();
    expect(spy).toHaveBeenCalledWith(expect.objectContaining({ zip: "37208", usage: "get", ages: ["3_12mo"] }));
    expect(updateUser).toHaveBeenCalledWith(saved);
  });

  it("shows the rules before turning Give support on", async () => {
    const spy = vi.spyOn(api, "savePersonProfile").mockResolvedValue({ profile: { ...PROFILE, usage: "both" } });
    renderPage();
    toggle("Give support");
    expect(screen.getByText(/No breastmilk, medicine/)).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "Not now" }));
    expect(screen.getByRole("switch", { name: "Give support" })).not.toBeChecked();
    toggle("Give support");
    fireEvent.click(screen.getByRole("button", { name: "Turn on Give support" }));
    expect(screen.getByRole("switch", { name: "Give support" })).toBeChecked();
    save();
    await screen.findByText("Saved");
    expect(spy.mock.calls[0][0].usage).toBe("both");
  });

  it("keeps at least one switch on", () => {
    renderPage();
    toggle("Get support");
    expect(screen.getByText("Keep at least one on.")).toBeInTheDocument();
    expect(screen.getByRole("switch", { name: "Get support" })).toBeChecked();
  });

  it("can switch to Give only", async () => {
    const spy = vi.spyOn(api, "savePersonProfile").mockResolvedValue({ profile: { ...PROFILE, usage: "give" } });
    renderPage({ account_type: "person", profile: { ...PROFILE, usage: "both" } });
    toggle("Get support");
    save();
    await screen.findByText("Saved");
    expect(spy.mock.calls[0][0].usage).toBe("give");
    toggle("Give support");
    expect(screen.getByText("Keep at least one on.")).toBeInTheDocument();
  });

  it("checks every step before saving and opens the one that's missing an answer", async () => {
    const spy = vi.spyOn(api, "savePersonProfile");
    renderPage({ account_type: "person", profile: { ...PROFILE, stage: "expecting", ages: [] } });
    fireEvent.click(screen.getByRole("button", { name: "Edit Family stage" }));
    fireEvent.click(screen.getByRole("radio", { name: "Parenting" }));
    fireEvent.click(screen.getByRole("button", { name: "Done" }));
    expect(screen.getByText("You have changes that aren't saved yet.")).toBeInTheDocument();
    save();
    expect(screen.getByText("Pick an age group for each child.")).toBeInTheDocument();
    expect(spy).not.toHaveBeenCalled();
  });

  it("opens the answer the server refused", async () => {
    vi.spyOn(api, "savePersonProfile").mockRejectedValue(
      new ApiError("Prefer not to say can't be picked with other roles.", { roles: ["Prefer not to say can't be picked with other roles."] }, 400)
    );
    renderPage();
    save();
    expect(await screen.findByRole("heading", { name: "Your children and your role" })).toBeInTheDocument();
    expect(screen.getAllByText(/Prefer not to say can't be picked/).length).toBeGreaterThan(0);
  });

  it("keeps the changes on screen when saving fails", async () => {
    vi.spyOn(api, "savePersonProfile").mockRejectedValue(new ApiError("Server down", {}, 500));
    renderPage();
    fireEvent.click(screen.getByRole("button", { name: "Edit Needs" }));
    fireEvent.click(screen.getByRole("checkbox", { name: "Food & feeding support" }));
    fireEvent.click(screen.getByRole("button", { name: "Done" }));
    save();
    expect(await screen.findByText("Your changes weren't saved. Server down")).toBeInTheDocument();
    expect(screen.getByText("Diapers & everyday essentials, Food & feeding support")).toBeInTheDocument();
  });

  it("keeps a way to items and claims whose tab is hidden", () => {
    renderPage();
    expect(screen.getByRole("link", { name: "My items" })).toHaveAttribute("href", ROUTES.give);
    expect(screen.queryByRole("link", { name: "My claims" })).not.toBeInTheDocument();
  });

  it("links to My claims while Get support is off", () => {
    renderPage({ account_type: "person", profile: { ...PROFILE, usage: "give" } });
    expect(screen.getByRole("link", { name: "My claims" })).toHaveAttribute("href", ROUTES.claims);
  });

  it("goes back from an edit screen", () => {
    renderPage();
    fireEvent.click(screen.getByRole("button", { name: "Edit Needs" }));
    fireEvent.click(screen.getByRole("button", { name: "← Back" }));
    expect(screen.getByRole("button", { name: "Save changes" })).toBeInTheDocument();
  });

  it("signs out to the welcome screen", async () => {
    const { logout } = renderPage();
    fireEvent.click(screen.getByRole("button", { name: "Sign out" }));
    expect(await screen.findByText("Welcome screen")).toBeInTheDocument();
    expect(logout).toHaveBeenCalled();
  });

  it("sends a person without a profile to set one up", () => {
    renderPage({ account_type: "person", profile: null });
    expect(screen.getByRole("link", { name: "Set up your profile" })).toHaveAttribute("href", ROUTES.profileSetup);
  });
});

describe("ProfilePage (organization)", () => {
  it("shows the account and links a verified organization to its profile", () => {
    renderPage({
      account_type: "organization", name: "Closet", email: "lead@closet.org", organization: { status: "verified" },
    });
    expect(screen.getByText("lead@closet.org")).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "Organization profile" })).toHaveAttribute("href", ROUTES.orgProfile);
  });
});
