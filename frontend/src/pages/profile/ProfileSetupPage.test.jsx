import { fireEvent, render, screen } from "@testing-library/react";
import { MemoryRouter, Route, Routes } from "react-router-dom";
import { afterEach, describe, expect, it, vi } from "vitest";
import * as api from "../../api/client.js";
import * as auth from "../../context/AuthContext.jsx";
import { ROUTES } from "../../routes.js";
import ProfileSetupPage from "./ProfileSetupPage.jsx";

const PERSON = { name: "Ada", account_type: "person", profile: null, gives: false };

function renderPage() {
  const updateUser = vi.fn();
  vi.spyOn(auth, "useAuth").mockReturnValue({ user: PERSON, updateUser });
  render(
    <MemoryRouter initialEntries={[ROUTES.profileSetup]} future={{ v7_startTransition: true, v7_relativeSplatPath: true }}>
      <Routes>
        <Route path={ROUTES.profileSetup} element={<ProfileSetupPage />} />
        <Route path={ROUTES.home} element={<p>Home</p>} />
      </Routes>
    </MemoryRouter>
  );
  return updateUser;
}

const click = (role, name) => fireEvent.click(screen.getByRole(role, { name }));
const next = () => click("button", "Next");
const zip = () => screen.getByLabelText("ZIP code (required)");

function fillStep1(stage = "Parenting") {
  fireEvent.change(zip(), { target: { value: "37206" } });
  click("radio", stage);
  next();
}
function fillStep2() {
  click("radio", "3-12 mo");
  next();
}
function fillStep3() {
  click("checkbox", "Diapers & everyday essentials");
  next();
}

afterEach(() => vi.restoreAllMocks());

describe("ProfileSetupPage", () => {
  it("says which answer is missing on step 1 and keeps only digits in the ZIP", () => {
    renderPage();
    expect(screen.getByText("Step 1 of 4")).toBeInTheDocument();
    fireEvent.change(zip(), { target: { value: "37a2" } });
    expect(zip()).toHaveValue("372");
    next();
    expect(screen.getByText("Enter your 5-digit ZIP code.")).toBeInTheDocument();
    expect(screen.getByText("Pick Expecting, Parenting, or Both.")).toBeInTheDocument();
    expect(screen.getByText("Step 1 of 4")).toBeInTheDocument();
  });

  it("shows the arrival month only for Expecting or Both", () => {
    renderPage();
    expect(screen.queryByLabelText("Expected arrival month")).not.toBeInTheDocument();
    click("radio", "Expecting");
    expect(screen.getByLabelText("Expected arrival month")).toBeInTheDocument();
    click("radio", "Parenting");
    expect(screen.queryByLabelText("Expected arrival month")).not.toBeInTheDocument();
    click("radio", "Both");
    expect(screen.getByLabelText("Expected arrival month")).toBeInTheDocument();
  });

  it("needs an age group for each child when parenting", () => {
    renderPage();
    fillStep1("Parenting");
    expect(screen.getByText("Step 2 of 4")).toBeInTheDocument();
    next();
    expect(screen.getByText("Pick an age group for each child.")).toBeInTheDocument();

    click("radio", "3-12 mo");
    click("button", "+ Add another child");
    next();
    expect(screen.getByText("Pick an age group for each child.")).toBeInTheDocument();
    click("button", "Remove child 2");
    next();
    expect(screen.getByText("Step 3 of 4")).toBeInTheDocument();
  });

  it("lets an expecting person skip children", () => {
    renderPage();
    fillStep1("Expecting");
    next();
    expect(screen.getByText("Step 3 of 4")).toBeInTheDocument();
  });

  it("clears other roles for Prefer not to say, and the other way round", () => {
    renderPage();
    fillStep1();
    click("checkbox", "Parent");
    click("checkbox", "Foster parent");
    expect(screen.getByRole("checkbox", { name: "Parent" })).toBeChecked();
    click("checkbox", "Prefer not to say");
    expect(screen.getByRole("checkbox", { name: "Prefer not to say" })).toBeChecked();
    expect(screen.getByRole("checkbox", { name: "Parent" })).not.toBeChecked();
    expect(screen.getByRole("checkbox", { name: "Foster parent" })).not.toBeChecked();
    click("checkbox", "Legal guardian");
    expect(screen.getByRole("checkbox", { name: "Prefer not to say" })).not.toBeChecked();
    click("checkbox", "Legal guardian");
    expect(screen.getByRole("checkbox", { name: "Legal guardian" })).not.toBeChecked();
  });

  it("explains kinship caregiver", () => {
    renderPage();
    fillStep1();
    click("button", "What is a kinship caregiver?");
    expect(screen.getByText("You care for a relative's or close family friend's child.")).toBeInTheDocument();
  });

  it("needs at least one need and one way to use PVill", () => {
    renderPage();
    fillStep1();
    fillStep2();
    next();
    expect(screen.getByText("Pick at least one.")).toBeInTheDocument();
    click("checkbox", "Housing & family stability");
    click("checkbox", "Housing & family stability");
    next();
    expect(screen.getByText("Pick at least one.")).toBeInTheDocument();
    fillStep3();
    click("button", "Finish my profile");
    expect(screen.getByText("Pick how you want to use PVill.")).toBeInTheDocument();
  });

  it("keeps answers when going back", () => {
    renderPage();
    fillStep1();
    click("button", "← Back");
    expect(zip()).toHaveValue("37206");
    expect(screen.getByRole("radio", { name: "Parenting" })).toHaveAttribute("aria-checked", "true");
  });

  it("saves every answer and opens Home", async () => {
    const saved = { ...PERSON, gives: true };
    const save = vi.spyOn(api, "savePersonProfile").mockResolvedValue(saved);
    const updateUser = renderPage();
    fireEvent.change(zip(), { target: { value: "37206" } });
    click("radio", "Both");
    fireEvent.change(screen.getByLabelText("Expected arrival month"), { target: { value: "2027-03" } });
    next();
    click("radio", "3-12 mo");
    click("checkbox", "Kinship caregiver");
    next();
    fillStep3();
    click("radio", /Both/);
    click("button", "Finish my profile");

    expect(await screen.findByText("Home")).toBeInTheDocument();
    expect(save).toHaveBeenCalledWith({
      zip: "37206",
      stage: "both",
      arrival_month: "2027-03",
      ages: ["3_12mo"],
      roles: ["kinship"],
      needs: ["essentials"],
      usage: "both",
    });
    expect(updateUser).toHaveBeenCalledWith(saved);
  });

  it("drops the arrival month and empty children when parenting or expecting", async () => {
    const save = vi.spyOn(api, "savePersonProfile").mockResolvedValue(PERSON);
    renderPage();
    click("radio", "Expecting");
    fireEvent.change(screen.getByLabelText("Expected arrival month"), { target: { value: "2027-03" } });
    click("radio", "Parenting");
    fillStep1("Parenting");
    fillStep2();
    fillStep3();
    click("radio", /Get support/);
    click("button", "Finish my profile");
    expect(await screen.findByText("Home")).toBeInTheDocument();
    expect(save.mock.calls[0][0]).toMatchObject({ arrival_month: "", ages: ["3_12mo"], usage: "get" });
  });

  it("keeps the answers on screen when saving fails", async () => {
    vi.spyOn(api, "savePersonProfile").mockRejectedValue(new api.ApiError("Request failed", {}, 500));
    renderPage();
    fillStep1();
    fillStep2();
    fillStep3();
    click("radio", /Give support/);
    click("button", "Finish my profile");
    expect(await screen.findByText("Your answers weren't saved. Request failed")).toBeInTheDocument();
    expect(screen.getByRole("radio", { name: /Give support/ })).toHaveAttribute("aria-checked", "true");
    expect(screen.getByRole("button", { name: "Finish my profile" })).toBeEnabled();
  });
});
