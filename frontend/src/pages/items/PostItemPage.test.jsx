import { StrictMode } from "react";
import { act, fireEvent, render, screen } from "@testing-library/react";
import { MemoryRouter, Route, Routes } from "react-router-dom";
import { afterEach, describe, expect, it, vi } from "vitest";
import * as api from "../../api/client.js";
import { ApiError } from "../../api/client.js";
import * as auth from "../../context/AuthContext.jsx";
import { ROUTES } from "../../routes.js";
import PostItemPage from "./PostItemPage.jsx";

const PERSON = { account_type: "person", gives: true, organization: null };
const ORG = {
  account_type: "organization",
  organization: { status: "verified", pickup_address: "123 Example St, Nashville, TN 37206" },
};

function renderPage(user = PERSON) {
  vi.spyOn(auth, "useAuth").mockReturnValue({ user });
  render(
    <MemoryRouter future={{ v7_startTransition: true, v7_relativeSplatPath: true }}>
      <PostItemPage />
    </MemoryRouter>
  );
}

const type = (label, value) => fireEvent.change(screen.getByLabelText(label), { target: { value } });
const click = (role, name) => fireEvent.click(screen.getByRole(role, { name }));

function fillStep1() {
  type("Item name", "Crib");
  type("Category", "furniture");
  type("Details", "Graco, like new");
  click("checkbox", "This item is in good condition");
  click("checkbox", "I checked that it is not recalled");
  click("button", "Next: pickup details");
}
function fillStep2(address = "12 Sample Ave, Nashville, TN 37206") {
  type("Date", "2030-10-21");
  type("From", "17:00");
  type("To", "19:00");
  type("General area (shown to everyone)", "East Nashville");
  if (address) type("Exact address (private until you approve)", address);
}

afterEach(() => vi.restoreAllMocks());

describe("PostItemPage", () => {
  it("says which answers are missing on step 1", () => {
    renderPage();
    expect(screen.getByText("Step 1 of 2 · About the item")).toBeInTheDocument();
    expect(screen.getByText("Not allowed: car seats, breastmilk, medicine, and other health-sensitive items.")).toBeInTheDocument();
    click("button", "Next: pickup details");
    expect(screen.getByText("Add the item name.")).toBeInTheDocument();
    expect(screen.getByText("Pick a category.")).toBeInTheDocument();
    expect(screen.getByText("Add the details.")).toBeInTheDocument();
    expect(screen.getByText("Check both boxes to post.")).toBeInTheDocument();
    type("How many?", "0");
    click("button", "Next: pickup details");
    expect(screen.getByText("Enter how many, 1 or more.")).toBeInTheDocument();
  });

  it("says which answers are missing on step 2 and Back keeps what was typed", () => {
    renderPage();
    fillStep1();
    expect(screen.getByText("Step 2 of 2 · Pickup details")).toBeInTheDocument();
    click("button", "Post item");
    expect(screen.getByText("Pick the pickup date.")).toBeInTheDocument();
    expect(screen.getByText("Pick the time window.")).toBeInTheDocument();
    expect(screen.getByText("Add the general area.")).toBeInTheDocument();
    expect(screen.getByText("Add the exact address.")).toBeInTheDocument();
    type("General area (shown to everyone)", "East Nashville");
    click("button", "← Back");
    expect(screen.getByLabelText("Item name")).toHaveValue("Crib");
    click("button", "Next: pickup details");
    expect(screen.getByLabelText("General area (shown to everyone)")).toHaveValue("East Nashville");
  });

  it("posts the item with its photos and shows Posted", async () => {
    const spy = vi.spyOn(api, "postItem").mockResolvedValue({ name: "Crib", general_area: "East Nashville" });
    renderPage();
    const photo = new File(["x"], "crib.png", { type: "image/png" });
    fireEvent.change(screen.getByLabelText(/Photos \(add up to 4\)/), { target: { files: [photo] } });
    expect(screen.getByText("crib.png")).toBeInTheDocument();
    fillStep1();
    fillStep2();
    click("button", "Post item");
    expect(await screen.findByRole("heading", { name: "Posted" })).toBeInTheDocument();
    expect(screen.getByText("Crib is posted for pickup in East Nashville.")).toBeInTheDocument();
    expect(spy).toHaveBeenCalledWith(
      expect.objectContaining({ name: "Crib", category: "furniture", quantity: "1", exact_address: "12 Sample Ave, Nashville, TN 37206" }),
      [photo]
    );
    expect(screen.getByRole("link", { name: "My items" })).toHaveAttribute("href", ROUTES.give);
    click("button", "Post another item");
    expect(screen.getByLabelText("Item name")).toHaveValue("");
  });

  it("limits photos to 4 under 5 MB and lets one be removed", () => {
    renderPage();
    const input = screen.getByLabelText(/Photos \(add up to 4\)/);
    const files = [1, 2, 3, 4, 5].map((n) => new File(["x"], `${n}.png`, { type: "image/png" }));
    fireEvent.change(input, { target: { files } });
    expect(screen.getByText("Add up to 4 photos.")).toBeInTheDocument();
    expect(screen.queryByText("5.png")).not.toBeInTheDocument();
    fireEvent.click(screen.getAllByRole("button", { name: "Remove" })[0]);
    expect(screen.queryByText("1.png")).not.toBeInTheDocument();
    expect(screen.queryByText("Add up to 4 photos.")).not.toBeInTheDocument();
    const big = new File(["x"], "big.png", { type: "image/png" });
    Object.defineProperty(big, "size", { value: 6 * 1024 * 1024 });
    const ok = new File(["x"], "ok.png", { type: "image/png" });
    fireEvent.change(input, { target: { files: [big, ok] } });
    expect(screen.getByText("big.png is too big. Use photos under 5 MB.")).toBeInTheDocument();
    expect(screen.getByText("ok.png")).toBeInTheDocument();
  });

  it("keeps what was typed when posting fails, and goes back to step 1 for its errors", async () => {
    vi.spyOn(api, "postItem").mockRejectedValueOnce(new Error("Failed to fetch"));
    renderPage();
    fillStep1();
    fillStep2();
    click("button", "Post item");
    expect(await screen.findByText("Your item wasn't posted. Failed to fetch")).toBeInTheDocument();
    expect(screen.getByLabelText("General area (shown to everyone)")).toHaveValue("East Nashville");

    api.postItem.mockRejectedValueOnce(new ApiError("Bad name.", { name: ["Bad name."] }, 400));
    click("button", "Post item");
    expect(await screen.findByText("Your item wasn't posted. Bad name.")).toBeInTheDocument();
    expect(screen.getByLabelText("Item name")).toHaveValue("Crib");
  });

  it("fills in an organization's public address and doesn't send one", async () => {
    const spy = vi.spyOn(api, "postItem").mockResolvedValue({ name: "Crib", general_area: "Downtown" });
    renderPage(ORG);
    fillStep1();
    expect(screen.getByLabelText("Public pickup address")).toHaveValue("123 Example St, Nashville, TN 37206");
    expect(screen.getByLabelText("Public pickup address")).toHaveAttribute("readonly");
    fillStep2(null);
    click("button", "Post item");
    await screen.findByRole("heading", { name: "Posted" });
    expect(spy.mock.calls[0][0]).not.toHaveProperty("exact_address");
    expect(screen.getByRole("link", { name: "My items" })).toHaveAttribute("href", ROUTES.orgItems);
  });

  it("sends an organization without a profile address to its profile", () => {
    renderPage({ ...ORG, organization: { status: "verified", pickup_address: "" } });
    fillStep1();
    expect(screen.getByRole("link", { name: "Organization profile" })).toHaveAttribute("href", ROUTES.orgProfile);
    expect(screen.getByRole("button", { name: "Post item" })).toBeDisabled();
  });
});

describe("PostItemPage editing", () => {
  const SAVED = {
    id: 7, name: "Crib", category: "furniture", details: "Graco", quantity: 2, pickup_date: "2030-10-21",
    pickup_start: "17:00:00", pickup_end: "19:00:00", general_area: "East Nashville",
    exact_address: "12 Sample Ave, Nashville, TN 37206", where_to_go: "", what_to_bring: "",
  };

  function renderEdit(user = PERSON) {
    vi.spyOn(auth, "useAuth").mockReturnValue({ user });
    render(
      <MemoryRouter initialEntries={[ROUTES.editItem(7)]} future={{ v7_startTransition: true, v7_relativeSplatPath: true }}>
        <Routes>
          <Route path={ROUTES.editItem()} element={<PostItemPage />} />
          <Route path={ROUTES.give} element={<p>My items list</p>} />
        </Routes>
      </MemoryRouter>
    );
  }

  it("fills in the saved answers, without photos, and saves changes", async () => {
    vi.spyOn(api, "getMyItem").mockResolvedValue(SAVED);
    const edit = vi.spyOn(api, "editItem").mockResolvedValue({ ...SAVED, quantity: 3 });
    renderEdit();
    expect(await screen.findByRole("heading", { name: "Edit item" })).toBeInTheDocument();
    expect(screen.getByLabelText("Item name")).toHaveValue("Crib");
    expect(screen.queryByLabelText(/Photos/)).not.toBeInTheDocument();
    type("How many?", "3");
    click("button", "Next: pickup details");
    expect(screen.getByLabelText("From")).toHaveValue("17:00");
    expect(screen.getByLabelText("Exact address (private until you approve)")).toHaveValue(SAVED.exact_address);
    click("button", "Save changes");
    expect(await screen.findByText("My items list")).toBeInTheDocument();
    expect(edit).toHaveBeenCalledWith("7", expect.objectContaining({ quantity: "3", good_condition: true }));
  });

  it("keeps what was typed when saving fails", async () => {
    vi.spyOn(api, "getMyItem").mockResolvedValue(SAVED);
    vi.spyOn(api, "editItem").mockRejectedValue(new Error("Failed to fetch"));
    renderEdit();
    await screen.findByRole("heading", { name: "Edit item" });
    click("button", "Next: pickup details");
    type("General area (shown to everyone)", "Downtown");
    click("button", "Save changes");
    expect(await screen.findByText("Your changes weren't saved. Failed to fetch")).toBeInTheDocument();
    expect(screen.getByLabelText("General area (shown to everyone)")).toHaveValue("Downtown");
  });

  it("ignores a load that answers after a newer one, so it can't undo what was typed", async () => {
    const replies = [];
    vi.spyOn(api, "getMyItem").mockImplementation(() => new Promise((resolve) => replies.push(resolve)));
    vi.spyOn(auth, "useAuth").mockReturnValue({ user: PERSON });
    render(
      // StrictMode runs the load effect twice, as the dev server does.
      <StrictMode>
        <MemoryRouter initialEntries={[ROUTES.editItem(7)]} future={{ v7_startTransition: true, v7_relativeSplatPath: true }}>
          <Routes>
            <Route path={ROUTES.editItem()} element={<PostItemPage />} />
          </Routes>
        </MemoryRouter>
      </StrictMode>
    );
    expect(replies).toHaveLength(2);
    await act(async () => replies[1](SAVED));
    type("How many?", "3");
    await act(async () => replies[0](SAVED));
    expect(screen.getByLabelText("How many?")).toHaveValue(3);
  });

  it("says when the item couldn't load", async () => {
    vi.spyOn(api, "getMyItem").mockRejectedValue(new ApiError("Not found.", {}, 404));
    renderEdit();
    expect(await screen.findByText("This item couldn't load. Not found.")).toBeInTheDocument();
  });
});
