import { fireEvent, render, screen } from "@testing-library/react";
import { MemoryRouter, Route, Routes, useLocation } from "react-router-dom";
import { describe, expect, it } from "vitest";
import { ROUTES } from "../../routes.js";
import AccountTypePage from "./AccountTypePage.jsx";

function ShowLocation() {
  const { pathname, search } = useLocation();
  return <p>{pathname + search}</p>;
}

function renderPage() {
  render(
    <MemoryRouter initialEntries={[ROUTES.accountType]} future={{ v7_startTransition: true, v7_relativeSplatPath: true }}>
      <Routes>
        <Route path={ROUTES.accountType} element={<AccountTypePage />} />
        <Route path={ROUTES.signup} element={<ShowLocation />} />
      </Routes>
    </MemoryRouter>
  );
}

describe("AccountTypePage", () => {
  it("keeps Continue disabled until a card is picked", () => {
    renderPage();
    expect(screen.getByRole("button", { name: "Continue" })).toBeDisabled();
    fireEvent.click(screen.getByRole("radio", { name: /A person/ }));
    expect(screen.getByRole("button", { name: "Continue" })).toBeEnabled();
  });

  it("allows only one pick", () => {
    renderPage();
    const person = screen.getByRole("radio", { name: /A person/ });
    const org = screen.getByRole("radio", { name: /An organization/ });
    fireEvent.click(person);
    fireEvent.click(org);
    expect(person).toHaveAttribute("aria-checked", "false");
    expect(org).toHaveAttribute("aria-checked", "true");
  });

  it("continues to sign-up with the chosen type", () => {
    renderPage();
    fireEvent.click(screen.getByRole("radio", { name: /An organization/ }));
    fireEvent.click(screen.getByRole("button", { name: "Continue" }));
    expect(screen.getByText("/signup?type=organization")).toBeInTheDocument();
  });
});
