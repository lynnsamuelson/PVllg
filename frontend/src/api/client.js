// All API calls go to same-origin /api (Vite proxy in dev, Apache in prod).
// Django sets a csrftoken cookie (via /api/auth/csrf/); writes must echo it in X-CSRFToken.

function getCookie(name) {
  const match = document.cookie.match(new RegExp(`(?:^|; )${name}=([^;]*)`));
  return match ? decodeURIComponent(match[1]) : null;
}

// AuthContext registers a callback here so any 401 ("not logged in") logs the user out locally.
let onUnauthorized = () => {};
export function setUnauthorizedHandler(fn) {
  onUnauthorized = fn;
}

// Error with the API's per-field messages attached, e.g. err.fields.email = ["..."].
export class ApiError extends Error {
  constructor(message, fields = {}, status = 0) {
    super(message);
    this.fields = fields;
    this.status = status;
  }
}

function toApiError(data, fallback, status) {
  if (!data || typeof data !== "object") return new ApiError(fallback, {}, status);
  const { detail, non_field_errors, ...fields } = data;
  const message = detail || non_field_errors?.[0] || Object.values(fields).flat()[0] || fallback;
  return new ApiError(message, fields, status);
}

async function request(path, options = {}) {
  const method = (options.method || "GET").toUpperCase();
  const headers = { "Content-Type": "application/json", ...options.headers };
  if (method !== "GET") {
    if (!getCookie("csrftoken")) await fetch("/api/auth/csrf/", { credentials: "same-origin" });
    headers["X-CSRFToken"] = getCookie("csrftoken");
  }
  const resp = await fetch(`/api${path}`, { ...options, method, headers, credentials: "same-origin" });
  const data = resp.status === 204 ? null : await resp.json().catch(() => null);
  if (resp.status === 401) onUnauthorized();
  if (!resp.ok) throw toApiError(data, resp.statusText || "Request failed", resp.status);
  return data;
}

const post = (path, body) => request(path, { method: "POST", body: body && JSON.stringify(body) });

// Auth
export const ensureCsrf = () => request("/auth/csrf/");
export const getCurrentUser = () => request("/auth/me/").then((d) => d.user);
export const signup = (name, email, password, accountType) =>
  post("/auth/signup/", { name, email, password, account_type: accountType }).then((d) => d.user);
export const login = (email, password) => post("/auth/login/", { email, password }).then((d) => d.user);
export const logout = () => post("/auth/logout/");

// Organization email check (KAN-7). Each returns the updated user.
export const startOrgVerification = (name, website, workEmail) =>
  post("/auth/org/", { name, website, work_email: workEmail }).then((d) => d.user);
export const resendOrgCode = () => post("/auth/org/resend/").then((d) => d.user);
export const verifyOrgCode = (code) => post("/auth/org/verify/", { code }).then((d) => d.user);

// Resources (login required)
export const listResources = () => request("/resources/");
export const getResource = (id) => request(`/resources/${id}/`);

// Demo endpoints (used by the /status page)
export const getHealth = () => request("/health/");
export const listNotes = () => request("/notes/");
export const createNote = (note) => post("/notes/", note);
export const deleteNote = (id) => request(`/notes/${id}/`, { method: "DELETE" });
