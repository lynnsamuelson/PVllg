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

  it("signs up with an account type and returns the new user", async () => {
    vi.spyOn(api, "ensureCsrf").mockResolvedValue({});
    vi.spyOn(api, "getCurrentUser").mockResolvedValue(null);
    const created = { name: "Food Bank", account_type: "organization" };
    const signupApi = vi.spyOn(api, "signup").mockResolvedValue(created);
    let auth;
    function Grab() {
      auth = useAuth();
      return <ShowUser />;
    }
    render(<AuthProvider><Grab /></AuthProvider>);
    await screen.findByText("nobody");

    let returned;
    await act(async () => (returned = await auth.signup("Food Bank", "hi@foodbank.org", "pw", "organization")));
    expect(signupApi).toHaveBeenCalledWith("Food Bank", "hi@foodbank.org", "pw", "organization");
    expect(returned).toBe(created);
    expect(screen.getByText("Food Bank")).toBeInTheDocument();
  });

  it("logs in, and logs out locally even when the API call fails", async () => {
    vi.spyOn(api, "ensureCsrf").mockResolvedValue({});
    vi.spyOn(api, "getCurrentUser").mockResolvedValue(null);
    vi.spyOn(api, "login").mockResolvedValue({ name: "Ada" });
    vi.spyOn(api, "logout").mockRejectedValue(new Error("offline"));
    let auth;
    function Grab() {
      auth = useAuth();
      return <ShowUser />;
    }
    render(<AuthProvider><Grab /></AuthProvider>);
    await screen.findByText("nobody");

    await act(() => auth.login("ada@example.com", "pw"));
    expect(screen.getByText("Ada")).toBeInTheDocument();
    await act(() => auth.logout().catch(() => {}));
    expect(screen.getByText("nobody")).toBeInTheDocument();
  });
});
