import { describe, expect, it, vi } from "vitest";

import {
  ApiError,
  getCurrentUser,
  login,
  resendOrgCode,
  setUnauthorizedHandler,
  startOrgVerification,
  verifyOrgCode,
  getResourceMatches,
} from "./client.js";

function jsonResponse(status, body) {
  return { ok: status >= 200 && status < 300, status, statusText: "", json: () => Promise.resolve(body) };
}

describe("api client", () => {
  it("sends profile answers and search options as query params for resource matches", async () => {
    const fetch = vi.fn(async () => jsonResponse(200, []));
    vi.stubGlobal("fetch", fetch);

    await getResourceMatches(
      { zip: "37206", stage: "parenting", ages: ["3_12mo"], roles: [], needs: ["essentials", "feeding"] },
      { category: "essentials", q: "" },
    );

    const url = new URL(fetch.mock.calls[0][0], "http://x");
    expect(url.pathname).toBe("/api/resources/matches/");
    expect(Object.fromEntries(url.searchParams)).toEqual({
      zip: "37206",
      stage: "parenting",
      ages: "3_12mo",
      needs: "essentials,feeding",
      category: "essentials",
    });
  });

  it("fetches a CSRF cookie before the first write and sends it as X-CSRFToken", async () => {
    const fetch = vi.fn(async (url) => {
      if (url === "/api/auth/csrf/") document.cookie = "csrftoken=abc123";
      return jsonResponse(200, { user: { email: "ada@example.com" } });
    });
    vi.stubGlobal("fetch", fetch);

    await login("ada@example.com", "pw");

    expect(fetch.mock.calls[0][0]).toBe("/api/auth/csrf/");
    const [url, options] = fetch.mock.calls[1];
    expect(url).toBe("/api/auth/login/");
    expect(options.headers["X-CSRFToken"]).toBe("abc123");
  });

  it("throws ApiError with per-field messages on validation errors", async () => {
    document.cookie = "csrftoken=abc123";
    vi.stubGlobal("fetch", vi.fn(async () => jsonResponse(400, { email: ["Already taken."] })));

    const err = await login("ada@example.com", "pw").catch((e) => e);

    expect(err).toBeInstanceOf(ApiError);
    expect(err.status).toBe(400);
    expect(err.message).toBe("Already taken.");
    expect(err.fields).toEqual({ email: ["Already taken."] });
  });

  it("calls the unauthorized handler on 401", async () => {
    const onUnauthorized = vi.fn();
    setUnauthorizedHandler(onUnauthorized);
    vi.stubGlobal("fetch", vi.fn(async () => jsonResponse(401, { detail: "Not logged in." })));

    await expect(getCurrentUser()).rejects.toThrow("Not logged in.");
    expect(onUnauthorized).toHaveBeenCalledOnce();
  });

  it("posts the organization email check and returns the user", async () => {
    document.cookie = "csrftoken=abc123";
    const fetch = vi.fn(async () => jsonResponse(200, { user: { id: 1 } }));
    vi.stubGlobal("fetch", fetch);

    expect(await startOrgVerification("Closet", "closet.org", "hi@closet.org")).toEqual({ id: 1 });
    await resendOrgCode();
    await verifyOrgCode("123456");

    const calls = fetch.mock.calls.map(([url, o]) => [url, o.body && JSON.parse(o.body)]);
    expect(calls).toEqual([
      ["/api/auth/org/", { name: "Closet", website: "closet.org", work_email: "hi@closet.org" }],
      ["/api/auth/org/resend/", undefined],
      ["/api/auth/org/verify/", { code: "123456" }],
    ]);
  });
});
