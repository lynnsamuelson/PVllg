import { describe, expect, it, vi } from "vitest";
import { ApiError, getCurrentUser, login, setUnauthorizedHandler } from "./client.js";

function jsonResponse(status, body) {
  return { ok: status >= 200 && status < 300, status, statusText: "", json: () => Promise.resolve(body) };
}

describe("api client", () => {
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
});
