import { fireEvent, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import * as api from "../../api/client.js";
import { ApiError } from "../../api/client.js";
import * as auth from "../../context/AuthContext.jsx";
import OrgProfilePage from "./OrgProfilePage.jsx";

const ORG = {
  name: "Sample Community Closet",
  account_type: "organization",
  organization: { name: "Sample Community Closet", status: "verified", about: "", serves: [], pickup_address: "", public_contact: "" },
};

function renderPage(user = ORG) {
  const updateUser = vi.fn();
  vi.spyOn(auth, "useAuth").mockReturnValue({ user, updateUser });
  render(<OrgProfilePage />);
  return updateUser;
}

const type = (label, value) => fireEvent.change(screen.getByLabelText(label), { target: { value } });
const save = () => fireEvent.click(screen.getByRole("button", { name: "Save profile" }));

afterEach(() => vi.restoreAllMocks());

describe("OrgProfilePage", () => {
  it("shows the name, Verified badge and the address hint", () => {
    renderPage();
    expect(screen.getByRole("heading", { name: "Sample Community Closet" })).toBeInTheDocument();
    expect(screen.getByText("Verified")).toBeInTheDocument();
    expect(screen.getByLabelText("Public pickup address")).toHaveAccessibleDescription(
      "Use your organization's address, not a person's home. It helps families find you nearby."
    );
  });

  it("saves the answers and says Saved", async () => {
    const saved = { ...ORG, organization: { ...ORG.organization, pickup_address: "123 Example St, Nashville, TN 37206" } };
    const spy = vi.spyOn(api, "saveOrgProfile").mockResolvedValue(saved);
    const updateUser = renderPage();
    type("About us", "We share diapers.");
    fireEvent.click(screen.getByRole("checkbox", { name: "Foster families" }));
    fireEvent.click(screen.getByRole("checkbox", { name: "New parents" }));
    fireEvent.click(screen.getByRole("checkbox", { name: "Foster families" }));
    type("Public pickup address", "123 Example St, Nashville, TN 37206");
    type("Public contact", "info@samplecommunitycloset.org");
    save();
    expect(await screen.findByText("Saved")).toBeInTheDocument();
    expect(spy).toHaveBeenCalledWith({
      about: "We share diapers.",
      serves: ["parents"],
      pickup_address: "123 Example St, Nashville, TN 37206",
      public_contact: "info@samplecommunitycloset.org",
    });
    expect(updateUser).toHaveBeenCalledWith(saved);
  });

  it("opens with what was saved before", () => {
    renderPage({
      ...ORG,
      organization: { ...ORG.organization, about: "Hi", serves: ["kinship"], pickup_address: "1 A St 37206", public_contact: "615-555-0100" },
    });
    expect(screen.getByLabelText("About us")).toHaveValue("Hi");
    expect(screen.getByRole("checkbox", { name: "Kinship caregivers" })).toHaveAttribute("aria-checked", "true");
    expect(screen.getByLabelText("Public pickup address")).toHaveValue("1 A St 37206");
    expect(screen.getByLabelText("Public contact")).toHaveValue("615-555-0100");
  });

  it("keeps the answers when the network fails", async () => {
    vi.spyOn(api, "saveOrgProfile").mockRejectedValue(new Error("Failed to fetch"));
    renderPage();
    type("About us", "We share diapers.");
    save();
    expect(await screen.findByText("Your profile wasn't saved. Failed to fetch")).toBeInTheDocument();
    expect(screen.getByLabelText("About us")).toHaveValue("We share diapers.");
  });

  it("keeps the answers and shows the errors when saving fails", async () => {
    vi.spyOn(api, "saveOrgProfile").mockRejectedValue(
      new ApiError("Add the ZIP code.", { pickup_address: ["Add the ZIP code."] }, 400)
    );
    renderPage();
    type("Public pickup address", "123 Example St, Nashville");
    save();
    expect(await screen.findByText("Your profile wasn't saved.")).toBeInTheDocument();
    expect(screen.getByText("Add the ZIP code.")).toBeInTheDocument();
    expect(screen.getByLabelText("Public pickup address")).toHaveValue("123 Example St, Nashville");
    expect(screen.getByLabelText("Public pickup address")).toHaveAttribute("aria-invalid", "true");
  });
});
