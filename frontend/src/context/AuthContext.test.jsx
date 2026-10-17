import { act, render, screen, waitFor } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import * as api from "../api/client.js";
import { AuthProvider, useAuth } from "./AuthContext.jsx";

function ShowUser() {
  const { user, loading } = useAuth();
  if (loading) return <p>loading</p>;
  return <p>{user ? user.name : "nobody"}</p>;
}

describe("AuthContext", () => {
  it("loads the current user on mount", async () => {
    vi.spyOn(api, "ensureCsrf").mockResolvedValue({});
    vi.spyOn(api, "getCurrentUser").mockResolvedValue({ name: "Ada" });
    render(<AuthProvider><ShowUser /></AuthProvider>);
    expect(await screen.findByText("Ada")).toBeInTheDocument();
  });

  it("treats a failed session check as logged out", async () => {
    vi.spyOn(api, "ensureCsrf").mockRejectedValue(new Error("offline"));
    render(<AuthProvider><ShowUser /></AuthProvider>);
    expect(await screen.findByText("nobody")).toBeInTheDocument();
  });

  it("drops the user when the API reports a 401", async () => {
    let onUnauthorized;
    vi.spyOn(api, "setUnauthorizedHandler").mockImplementation((fn) => (onUnauthorized = fn));
    vi.spyOn(api, "ensureCsrf").mockResolvedValue({});
    vi.spyOn(api, "getCurrentUser").mockResolvedValue({ name: "Ada" });
    render(<AuthProvider><ShowUser /></AuthProvider>);
    await screen.findByText("Ada");

    act(() => onUnauthorized());
    await waitFor(() => expect(screen.getByText("nobody")).toBeInTheDocument());
  });
});
