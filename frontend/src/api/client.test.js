import { describe, expect, it, vi } from "vitest";

import {
  ApiError,
  getCurrentUser,
  login,
  resendOrgCode,
  savePersonProfile,
  setUnauthorizedHandler,
  startOrgVerification,
  verifyOrgCode,
  getResourceMatches,
  postItem,
  claimItem,
  listClaims,
  cancelClaim,
  reportProblem,
  markAvailable,
  calendarUrl,
  approveClaim,
  declineClaim,
  markPickedUp,
  familyDidntCome,
  searchItems,
  editItem,
  takeDownItem,
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

  it("posts an item as multipart form data with its photos", async () => {
    document.cookie = "csrftoken=abc123";
    const fetch = vi.fn(async () => jsonResponse(201, { id: 1 }));
    vi.stubGlobal("fetch", fetch);
    const photo = new File(["x"], "a.png", { type: "image/png" });

    await postItem({ name: "Crib", good_condition: true }, [photo]);

    const [url, options] = fetch.mock.calls[0];
    expect(url).toBe("/api/items/");
    expect(options.headers["Content-Type"]).toBeUndefined();
    expect(options.body.get("name")).toBe("Crib");
    expect(options.body.get("good_condition")).toBe("true");
    expect(options.body.getAll("photos")).toHaveLength(1);
  });

  it("sends only the search options that are set", async () => {
    const fetch = vi.fn(async () => jsonResponse(200, []));
    vi.stubGlobal("fetch", fetch);
    await searchItems({ q: "diapers", category: "", radius: "25" });
    expect(fetch.mock.calls[0][0]).toBe("/api/items/search/?q=diapers&radius=25");
  });

  it("claims, lists and cancels claims", async () => {
    document.cookie = "csrftoken=abc123";
    const fetch = vi.fn(async () => jsonResponse(200, []));
    vi.stubGlobal("fetch", fetch);
    await claimItem(5);
    expect(fetch.mock.calls[0][0]).toBe("/api/claims/");
    expect(fetch.mock.calls[0][1].body).toBe('{"item":5}');
    await listClaims("past");
    expect(fetch.mock.calls[1][0]).toBe("/api/claims/?tab=past");
    await listClaims("active");
    expect(fetch.mock.calls[2][0]).toBe("/api/claims/");
    await cancelClaim(5);
    expect(fetch.mock.calls[3][0]).toBe("/api/claims/5/cancel/");
    await approveClaim(5);
    await declineClaim(5);
    await markPickedUp(5);
    await familyDidntCome(5);
    expect(fetch.mock.calls.slice(4).map((c) => c[0])).toEqual([
      "/api/claims/5/approve/",
      "/api/claims/5/decline/",
      "/api/claims/5/picked-up/",
      "/api/claims/5/didnt-come/",
    ]);
  });

  it("reports a pickup problem and marks an item available", async () => {
    document.cookie = "csrftoken=abc123";
    const fetch = vi.fn(async () => jsonResponse(200, {}));
    vi.stubGlobal("fetch", fetch);
    await reportProblem(4, "not_there", "");
    expect(fetch.mock.calls[0][0]).toBe("/api/claims/4/report/");
    expect(fetch.mock.calls[0][1].body).toBe('{"reason":"not_there","note":""}');
    await markAvailable(7);
    expect(fetch.mock.calls[1][0]).toBe("/api/items/mine/7/available/");
  });

  it("builds the calendar file URL", () => {
    expect(calendarUrl(4)).toBe("/api/claims/4/calendar.ics");
    expect(calendarUrl(4, { reminders: ["day"], download: true })).toBe("/api/claims/4/calendar.ics?reminders=day&download=1");
  });

  it("edits an item as JSON and takes one down", async () => {
    document.cookie = "csrftoken=abc123";
    const fetch = vi.fn(async () => jsonResponse(200, { id: 7 }));
    vi.stubGlobal("fetch", fetch);

    await editItem(7, { quantity: "3" });
    expect(fetch.mock.calls[0][0]).toBe("/api/items/mine/7/");
    expect(fetch.mock.calls[0][1]).toMatchObject({ method: "PUT", body: '{"quantity":"3"}' });
    expect(fetch.mock.calls[0][1].headers["Content-Type"]).toBe("application/json");

    fetch.mockResolvedValueOnce({ ok: true, status: 204, statusText: "" });
    await takeDownItem(7);
    expect(fetch.mock.calls[1][1].method).toBe("DELETE");
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

  it("posts the person profile and returns the user", async () => {
    document.cookie = "csrftoken=abc123";
    const fetch = vi.fn(async () => jsonResponse(200, { user: { id: 2, gives: true } }));
    vi.stubGlobal("fetch", fetch);

    const answers = { zip: "37206", stage: "parenting", ages: ["3_12mo"], roles: [], needs: ["feeding"], usage: "both" };
    expect(await savePersonProfile(answers)).toEqual({ id: 2, gives: true });
    expect(fetch.mock.calls[0][0]).toBe("/api/auth/profile/");
    expect(JSON.parse(fetch.mock.calls[0][1].body)).toEqual(answers);
  });
});
