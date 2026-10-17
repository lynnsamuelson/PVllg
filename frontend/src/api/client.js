// All API calls go to same-origin /api (Vite proxy in dev, Apache in prod).
async function request(path, options = {}) {
  const resp = await fetch(`/api${path}`, {
    headers: { "Content-Type": "application/json" },
    ...options,
  });
  const data = resp.status === 204 ? null : await resp.json();
  if (!resp.ok) throw new Error(data?.error || data?.detail || resp.statusText);
  return data;
}

export const getHealth = () => request("/health/");
export const listNotes = () => request("/notes/");
export const createNote = (note) => request("/notes/", { method: "POST", body: JSON.stringify(note) });
export const deleteNote = (id) => request(`/notes/${id}/`, { method: "DELETE" });
