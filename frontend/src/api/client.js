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
  // FormData (photo uploads) sets its own multipart Content-Type.
  const json = !(options.body instanceof FormData);
  const headers = { ...(json && { "Content-Type": "application/json" }), ...options.headers };
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

// Person profile setup (KAN-6). answers = { zip, stage, arrival_month, ages[], roles[], needs[], usage }.
export const savePersonProfile = (answers) => post("/auth/profile/", answers).then((d) => d.user);

// Organization email check (KAN-7). Each returns the updated user.
export const startOrgVerification = (name, website, workEmail) =>
  post("/auth/org/", { name, website, work_email: workEmail }).then((d) => d.user);
export const resendOrgCode = () => post("/auth/org/resend/").then((d) => d.user);
export const verifyOrgCode = (code) => post("/auth/org/verify/", { code }).then((d) => d.user);
// Organization profile (KAN-8), Verified only. profile = { about, serves[], pickup_address, public_contact }.
export const saveOrgProfile = (profile) => post("/auth/org/profile/", profile).then((d) => d.user);

// Post an item (KAN-9). fields = the form's answers; photos = up to 4 image Files. Returns the saved item.
export function postItem(fields, photos = []) {
  const body = new FormData();
  for (const [key, value] of Object.entries(fields)) body.append(key, value);
  for (const photo of photos) body.append("photos", photo);
  return request("/items/", { method: "POST", body });
}

// Search near me, Items tab (KAN-15). options = { q, category, radius }. Nearest first, privacy rule applied.
export function searchItems(options = {}) {
  const params = new URLSearchParams();
  for (const [key, value] of Object.entries(options)) if (value) params.set(key, value);
  return request(`/items/search/?${params}`);
}

// Item details (KAN-17): one item with the address privacy rule applied (KAN-11).
export const getItem = (id) => request(`/items/${id}/`);

// Claims (KAN-12). Each claim has { id, status, held_until, item } with the item shaped like getItem's.
export const claimItem = (itemId) => post("/claims/", { item: itemId });
export const listClaims = (tab) => request(`/claims/${tab === "past" ? "?tab=past" : ""}`);
export const cancelClaim = (id) => post(`/claims/${id}/cancel/`);
export const getClaim = (id) => request(`/claims/${id}/`);
// Add to calendar (KAN-19): the .ics file's URL. reminders = ["day", "hour"]; download saves it instead of opening it.
export function calendarUrl(id, { reminders = [], download = false } = {}) {
  const params = new URLSearchParams();
  if (reminders.length) params.set("reminders", reminders.join(","));
  if (download) params.set("download", "1");
  const query = params.toString();
  return `/api/claims/${id}/calendar.ics${query ? `?${query}` : ""}`;
}
// The giver's answers (KAN-13). Each returns { id, status, held_until, family } with the family's first name only.
export const approveClaim = (id) => post(`/claims/${id}/approve/`);
export const declineClaim = (id) => post(`/claims/${id}/decline/`);
export const markPickedUp = (id) => post(`/claims/${id}/picked-up/`);
export const familyDidntCome = (id) => post(`/claims/${id}/didnt-come/`);

// My items (KAN-10): the giver's own items, with exact_address and counts (left, requested, claimed).
export const listMyItems = () => request("/items/mine/");
export const getMyItem = (id) => request(`/items/mine/${id}/`);
export const editItem = (id, fields) => request(`/items/mine/${id}/`, { method: "PUT", body: JSON.stringify(fields) });
export const takeDownItem = (id) => request(`/items/mine/${id}/`, { method: "DELETE" });

// Resources (login required)
export const listResources = () => request("/resources/");
export const getResource = (id) => request(`/resources/${id}/`);

// KAN-16: resources ranked for a profile. profile = { zip, stage, ages[], roles[], needs[] };
// options = { category, q, radius }. Each result adds distance_miles (null if not local), matches_needs, reason.
export function getResourceMatches(profile, options = {}) {
  const params = new URLSearchParams();
  for (const [key, value] of Object.entries({ ...profile, ...options })) {
    const text = Array.isArray(value) ? value.join(",") : value;
    if (text !== undefined && text !== null && text !== "") params.set(key, text);
  }
  return request(`/resources/matches/?${params}`);
}

// Demo endpoints (used by the /status page)
export const getHealth = () => request("/health/");
export const listNotes = () => request("/notes/");
export const createNote = (note) => post("/notes/", note);
export const deleteNote = (id) => request(`/notes/${id}/`, { method: "DELETE" });
