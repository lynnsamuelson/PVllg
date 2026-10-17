import { useEffect, useState } from "react";
import { createNote, deleteNote, getHealth, listNotes } from "./api.js";

export default function App() {
  const [health, setHealth] = useState(null);
  const [notes, setNotes] = useState([]);
  const [title, setTitle] = useState("");
  const [error, setError] = useState("");

  const refresh = () => listNotes().then(setNotes).catch((e) => setError(e.message));

  useEffect(() => {
    getHealth().then(setHealth).catch((e) => setHealth({ status: "error", error: e.message }));
    refresh();
  }, []);

  const onSubmit = async (e) => {
    e.preventDefault();
    if (!title.trim()) return;
    try {
      await createNote({ title });
      setTitle("");
      refresh();
    } catch (err) {
      setError(err.message);
    }
  };

  return (
    <main>
      <h1>PVllg</h1>

      <section className="card">
        <h2>API status</h2>
        {health ? (
          <p className={health.status === "ok" ? "ok" : "bad"}>
            {health.status} — {health.db} {health.db_version || health.error}
          </p>
        ) : (
          <p>checking…</p>
        )}
      </section>

      <section className="card">
        <h2>Notes (example CRUD)</h2>
        <form onSubmit={onSubmit}>
          <input value={title} onChange={(e) => setTitle(e.target.value)} placeholder="New note" />
          <button type="submit">Add</button>
        </form>
        {error && <p className="bad">{error}</p>}
        <ul>
          {notes.map((n) => (
            <li key={n.id}>
              {n.title}
              <button onClick={() => deleteNote(n.id).then(refresh)}>×</button>
            </li>
          ))}
        </ul>
      </section>
    </main>
  );
}
