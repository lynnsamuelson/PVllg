import { fireEvent, render, screen } from "@testing-library/react";
import { MemoryRouter, Route, Routes } from "react-router-dom";
import { afterEach, describe, expect, it, vi } from "vitest";
import * as api from "../../api/client.js";
import * as auth from "../../context/AuthContext.jsx";
import { ROUTES } from "../../routes.js";
import OrgSignupPage from "./OrgSignupPage.jsx";

const ORG_USER = { name: "Sample Community Closet", email: "lead@samplecommunitycloset.org", account_type: "organization", organization: null };

function renderAs(user) {
  const updateUser = vi.fn();
  vi.spyOn(auth, "useAuth").mockReturnValue({ user, updateUser });
  render(
    <MemoryRouter initialEntries={[ROUTES.orgSignup]} future={{ v7_startTransition: true, v7_relativeSplatPath: true }}>
      <Routes>
        <Route path={ROUTES.orgSignup} element={<OrgSignupPage />} />
        <Route path={ROUTES.orgVerify} element={<p>Enter the code</p>} />
        <Route path={ROUTES.orgItems} element={<p>My items</p>} />
        <Route path={ROUTES.home} element={<p>Home</p>} />
      </Routes>
    </MemoryRouter>
  );
  return updateUser;
}

const submit = () => fireEvent.click(screen.getByRole("button", { name: "Send me a code" }));

afterEach(() => vi.restoreAllMocks());

describe("OrgSignupPage", () => {
  it("prefills from the account and goes to the code screen once the code is sent", async () => {
    const updated = { ...ORG_USER, organization: { status: "pending" } };
    const start = vi.spyOn(api, "startOrgVerification").mockResolvedValue(updated);
    const updateUser = renderAs(ORG_USER);

    expect(screen.getByLabelText("Organization name")).toHaveValue("Sample Community Closet");
    fireEvent.change(screen.getByLabelText("Website"), { target: { value: "samplecommunitycloset.org" } });
    submit();

    expect(await screen.findByText("Enter the code")).toBeInTheDocument();
    expect(start).toHaveBeenCalledWith("Sample Community Closet", "samplecommunitycloset.org", "lead@samplecommunitycloset.org");
    expect(updateUser).toHaveBeenCalledWith(updated);
  });

  it("shows the API's message under the work email", async () => {
    const err = new api.ApiError("x", { work_email: ["Free email, like Gmail, can't be used to post items."] }, 400);
    vi.spyOn(api, "startOrgVerification").mockRejectedValue(err);
    renderAs(ORG_USER);
    fireEvent.change(screen.getByLabelText("Website"), { target: { value: "closet.org" } });
    submit();
    expect(await screen.findByText("Free email, like Gmail, can't be used to post items.")).toBeInTheDocument();
    expect(screen.getByLabelText("Work email")).toHaveAttribute("aria-invalid", "true");
  });

  it("shows other errors at the top", async () => {
    vi.spyOn(api, "startOrgVerification").mockRejectedValue(new api.ApiError("We just sent a code.", {}, 429));
    renderAs(ORG_USER);
    fireEvent.change(screen.getByLabelText("Website"), { target: { value: "closet.org" } });
    submit();
    expect(await screen.findByText("We just sent a code.")).toBeInTheDocument();
  });

  it("explains the no-domain-email path and lets the organization skip", () => {
    renderAs(ORG_USER);
    expect(screen.getByText(/No domain email\? You can still be listed as a resource/)).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "Skip for now" })).toHaveAttribute("href", ROUTES.orgItems);
  });

  it("sends people home", () => {
    renderAs({ account_type: "person", organization: null });
    expect(screen.getByText("Home")).toBeInTheDocument();
  });

  it("sends a verified organization to its items", () => {
    renderAs({ ...ORG_USER, organization: { status: "verified" } });
    expect(screen.getByText("My items")).toBeInTheDocument();
  });
});
