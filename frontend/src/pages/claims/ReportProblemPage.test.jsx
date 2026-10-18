import { fireEvent, render, screen } from "@testing-library/react";
import { MemoryRouter, Route, Routes } from "react-router-dom";
import { afterEach, describe, expect, it, vi } from "vitest";
import * as api from "../../api/client.js";
import { ApiError } from "../../api/client.js";
import { ROUTES } from "../../routes.js";
import ReportProblemPage from "./ReportProblemPage.jsx";

const CLAIM = { id: 4, status: "approved", can_report: true, item: { name: "Size 1 diapers", pickup_date: "2030-10-22" } };

function renderPage(result = CLAIM) {
  vi.spyOn(api, "getClaim").mockImplementation(() => (result instanceof Error ? Promise.reject(result) : Promise.resolve(result)));
  render(
    <MemoryRouter initialEntries={[ROUTES.claimReport(4)]} future={{ v7_startTransition: true, v7_relativeSplatPath: true }}>
      <Routes>
        <Route path={ROUTES.claimReport()} element={<ReportProblemPage />} />
      </Routes>
    </MemoryRouter>
  );
}

afterEach(() => vi.restoreAllMocks());

describe("ReportProblemPage", () => {
  it("asks what happened, one reason, with the item and date (Mock Up 17)", async () => {
    renderPage();
    expect(await screen.findByRole("heading", { name: "What happened at pickup?" })).toBeInTheDocument();
    expect(screen.getByText("Size 1 diapers · Tue, Oct 22")).toBeInTheDocument();
    expect(screen.getAllByRole("radio")).toHaveLength(6);
    expect(screen.getByLabelText("Short note (optional)")).toHaveAccessibleDescription(
      "Please don't include phone numbers or addresses."
    );
    expect(screen.getByLabelText("Short note (optional)")).toHaveAttribute("maxLength", "200");
    expect(screen.getByText("In an emergency, call 911.")).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "Send report" }));
    expect(screen.getByText("Pick what happened.")).toBeInTheDocument();
  });

  it("sends the report and shows what happens next (Mock Up 18)", async () => {
    const report = vi.spyOn(api, "reportProblem").mockResolvedValue({ reason: "The item wasn't there", chip: "essentials" });
    renderPage();
    fireEvent.click(await screen.findByRole("radio", { name: "The item wasn't there" }));
    fireEvent.change(screen.getByLabelText("Short note (optional)"), { target: { value: " Porch empty. " } });
    fireEvent.click(screen.getByRole("button", { name: "Send report" }));
    expect(await screen.findByRole("heading", { name: "Thank you. We're sorry this happened." })).toBeInTheDocument();
    expect(report).toHaveBeenCalledWith("4", "not_there", "Porch empty.");
    expect(screen.getByText(/A family reported: The item wasn't there/)).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "Find similar items nearby" })).toHaveAttribute(
      "href", `${ROUTES.search}?category=essentials`
    );
    expect(screen.getByRole("link", { name: "Back to My claims" })).toHaveAttribute("href", ROUTES.claims);
  });

  it("keeps the answers and says what happened when sending fails", async () => {
    vi.spyOn(api, "reportProblem").mockRejectedValue(new ApiError("You can report a problem from the start…", {}, 400));
    renderPage();
    fireEvent.click(await screen.findByRole("radio", { name: "Something else" }));
    fireEvent.change(screen.getByLabelText("Short note (optional)"), { target: { value: "Late." } });
    fireEvent.click(screen.getByRole("button", { name: "Send report" }));
    expect(await screen.findByText("Your report wasn't sent. You can report a problem from the start…")).toBeInTheDocument();
    expect(screen.getByRole("radio", { name: "Something else" })).toBeChecked();
    expect(screen.getByLabelText("Short note (optional)")).toHaveValue("Late.");
  });

  it("sends to Search without a chip for other categories", async () => {
    vi.spyOn(api, "reportProblem").mockResolvedValue({ reason: "Something else", chip: "" });
    renderPage();
    fireEvent.click(await screen.findByRole("radio", { name: "Something else" }));
    fireEvent.click(screen.getByRole("button", { name: "Send report" }));
    expect(await screen.findByRole("link", { name: "Find similar items nearby" })).toHaveAttribute("href", ROUTES.search);
  });

  it("says so right away outside the pickup window", async () => {
    renderPage({ ...CLAIM, can_report: false });
    expect(await screen.findByText(/from the start of the pickup window until a day after it ends/)).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Send report" })).not.toBeInTheDocument();
  });

  it("says when the claim can't be reported", async () => {
    renderPage(new ApiError("Not found.", {}, 404));
    expect(await screen.findByText("This claim isn't approved anymore.")).toBeInTheDocument();
  });
});
