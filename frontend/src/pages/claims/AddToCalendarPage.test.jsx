import { fireEvent, render, screen } from "@testing-library/react";
import { MemoryRouter, Route, Routes } from "react-router-dom";
import { afterEach, describe, expect, it, vi } from "vitest";
import * as api from "../../api/client.js";
import { ApiError } from "../../api/client.js";
import { ROUTES } from "../../routes.js";
import AddToCalendarPage from "./AddToCalendarPage.jsx";

const CLAIM = {
  id: 4, status: "approved",
  item: {
    name: "Size 1 diapers", pickup_date: "2030-10-22", pickup_start: "10:00:00", pickup_end: "14:00:00",
    general_area: "East Nashville", exact_address: "100 Sample Way, Nashville, TN 37206",
    where_to_go: "Front desk.", what_to_bring: "Bring a bag.", details: "Pack of 30.",
  },
  event: { where: "100 Sample Way, Nashville, TN 37206", notes: "Front desk. Bring a bag. Pack of 30." },
};

function renderPage(result) {
  vi.spyOn(api, "getClaim").mockImplementation(() => (result instanceof Error ? Promise.reject(result) : Promise.resolve(result)));
  render(
    <MemoryRouter initialEntries={[ROUTES.claimCalendar(4)]} future={{ v7_startTransition: true, v7_relativeSplatPath: true }}>
      <Routes>
        <Route path={ROUTES.claimCalendar()} element={<AddToCalendarPage />} />
      </Routes>
    </MemoryRouter>
  );
}

afterEach(() => vi.restoreAllMocks());

describe("AddToCalendarPage", () => {
  it("shows the event and links to the calendar file with both reminders (Mock Up 16)", async () => {
    renderPage(CLAIM);
    expect(await screen.findByRole("heading", { name: "Pick up: Size 1 diapers" })).toBeInTheDocument();
    expect(screen.getByText("Tue, Oct 22 · 10 am - 2 pm")).toBeInTheDocument();
    expect(screen.getByText("100 Sample Way, Nashville, TN 37206")).toBeInTheDocument();
    expect(screen.getByText("Front desk. Bring a bag. Pack of 30.")).toBeInTheDocument();
    expect(screen.getByRole("checkbox", { name: "1 day before" })).toBeChecked();
    expect(screen.getByRole("checkbox", { name: "1 hour before" })).toBeChecked();
    expect(screen.getByRole("link", { name: "Add to calendar" })).toHaveAttribute(
      "href", "/api/claims/4/calendar.ics?reminders=day%2Chour"
    );
    expect(screen.getByRole("link", { name: "Download calendar file" })).toHaveAttribute(
      "href", "/api/claims/4/calendar.ics?reminders=day%2Chour&download=1"
    );
    expect(screen.getByText(/the exact place is added only after the giver approves/)).toBeInTheDocument();
  });

  it("leaves out unchecked reminders", async () => {
    renderPage(CLAIM);
    fireEvent.click(await screen.findByRole("checkbox", { name: "1 day before" }));
    fireEvent.click(screen.getByRole("checkbox", { name: "1 hour before" }));
    expect(screen.getByRole("link", { name: "Add to calendar" })).toHaveAttribute("href", "/api/claims/4/calendar.ics");
  });

  it("says when the claim isn't current", async () => {
    renderPage(new ApiError("Not found.", {}, 404));
    expect(await screen.findByText("Only an approved claim can go in your calendar.")).toBeInTheDocument();
  });

  it("shows other errors as they are", async () => {
    renderPage(new Error("Failed to fetch"));
    expect(await screen.findByText("Failed to fetch")).toBeInTheDocument();
  });
});
