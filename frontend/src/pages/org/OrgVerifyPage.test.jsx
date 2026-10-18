import { fireEvent, render, screen } from "@testing-library/react";
import { MemoryRouter, Route, Routes } from "react-router-dom";
import { afterEach, describe, expect, it, vi } from "vitest";
import * as api from "../../api/client.js";
import * as auth from "../../context/AuthContext.jsx";
import { ROUTES } from "../../routes.js";
import OrgVerifyPage from "./OrgVerifyPage.jsx";

const pending = { account_type: "organization", organization: { work_email: "hi@closet.org", status: "pending" } };
const verified = { ...pending, organization: { ...pending.organization, status: "verified" } };

function renderAs(user) {
  const updateUser = vi.fn();
  vi.spyOn(auth, "useAuth").mockReturnValue({ user, updateUser });
  const view = render(<Page />);
  return { updateUser, rerenderAs: (u) => {
    vi.spyOn(auth, "useAuth").mockReturnValue({ user: u, updateUser });
    view.rerender(<Page />);
  } };
}

function Page() {
  return (
    <MemoryRouter initialEntries={[ROUTES.orgVerify]} future={{ v7_startTransition: true, v7_relativeSplatPath: true }}>
      <Routes>
        <Route path={ROUTES.orgVerify} element={<OrgVerifyPage />} />
        <Route path={ROUTES.orgSignup} element={<p>Org sign-up</p>} />
      </Routes>
    </MemoryRouter>
  );
}

const typeCode = (code) =>
  fireEvent.paste(screen.getByLabelText("Digit 1"), { clipboardData: { getData: () => code } });
const confirm = () => fireEvent.click(screen.getByRole("button", { name: "Confirm" }));

afterEach(() => vi.restoreAllMocks());

describe("OrgVerifyPage", () => {
  it("shows where the code went and a Pending status", () => {
    renderAs(pending);
    expect(screen.getByText("We sent a 6-digit code to hi@closet.org.")).toBeInTheDocument();
    expect(screen.getByText("Pending")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Confirm" })).toBeDisabled();
  });

  it("turns Verified after the right code", async () => {
    vi.spyOn(api, "verifyOrgCode").mockResolvedValue(verified);
    const { updateUser, rerenderAs } = renderAs(pending);
    typeCode("123456");
    confirm();
    await vi.waitFor(() => expect(updateUser).toHaveBeenCalledWith(verified));
    expect(api.verifyOrgCode).toHaveBeenCalledWith("123456");

    rerenderAs(verified);
    expect(screen.getByRole("heading", { name: "Email confirmed" })).toBeInTheDocument();
    expect(screen.getByText("Verified")).toBeInTheDocument();
    expect(screen.queryByText("Pending")).not.toBeInTheDocument();
    expect(screen.getByRole("link", { name: "Continue" })).toHaveAttribute("href", ROUTES.orgProfile);
  });

  it("says so when the code is wrong and lets them try again", async () => {
    vi.spyOn(api, "verifyOrgCode").mockRejectedValue(
      new api.ApiError("x", { code: ["That code isn't right. Try again."] }, 400)
    );
    renderAs(pending);
    typeCode("000000");
    confirm();
    expect(await screen.findByText("That code isn't right. Try again.")).toBeInTheDocument();
    expect(screen.getByText("Pending")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Confirm" })).toBeEnabled();
  });

  it("sends a new code and clears the boxes", async () => {
    vi.spyOn(api, "resendOrgCode").mockResolvedValue(pending);
    renderAs(pending);
    typeCode("111111");
    fireEvent.click(screen.getByRole("button", { name: "Send a new code" }));
    expect(await screen.findByText("We sent a new code. The old one no longer works.")).toBeInTheDocument();
    expect(screen.getByLabelText("Digit 1")).toHaveValue("");
  });

  it("shows a failed resend", async () => {
    vi.spyOn(api, "resendOrgCode").mockRejectedValue(new api.ApiError("We just sent a code.", {}, 429));
    renderAs(pending);
    fireEvent.click(screen.getByRole("button", { name: "Send a new code" }));
    expect(await screen.findByText("We just sent a code.")).toBeInTheDocument();
  });

  it("sends an organization with no details back to sign-up", () => {
    renderAs({ account_type: "organization", organization: null });
    expect(screen.getByText("Org sign-up")).toBeInTheDocument();
  });
});
