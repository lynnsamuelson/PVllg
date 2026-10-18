import { useEffect, useState } from "react";
import { useLocation, useNavigate } from "react-router-dom";
import * as api from "../../api/client.js";
import Button from "../../components/Button.jsx";
import NoteBox from "../../components/NoteBox.jsx";
import { ROUTES } from "../../routes.js";

// "1 listed · 1 requested", "0 left · 1 claimed", "2 left" (Mock Up 21). Never below zero.
export function countsLine(item) {
  const parts = [`${Math.max(item.left, 0)} left`];
  if (item.requested > 0) parts.push(`${item.requested} requested`);
  if (item.claimed > 0) parts.push(`${item.claimed} claimed`);
  return parts.join(" · ");
}

function ItemCard({ item, onTakenDown }) {
  const [confirming, setConfirming] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  const takeDown = async () => {
    setBusy(true);
    setError("");
    try {
      await api.takeDownItem(item.id);
      onTakenDown(item.id);
    } catch (err) {
      setError(`It wasn't taken down. ${err.message}`);
      setBusy(false);
    }
  };

  return (
    <li className="card item-card">
      <h2>{item.name}</h2>
      <p className="item-card-counts">{countsLine(item)}</p>
      {confirming ? (
        <div className="stack">
          <p>Are you sure? Families won't find {item.name} anymore.</p>
          <div className="row">
            <Button small onClick={takeDown} disabled={busy}>
              Yes, take down
            </Button>
            <Button small variant="outline" onClick={() => setConfirming(false)} disabled={busy}>
              Keep it
            </Button>
          </div>
        </div>
      ) : (
        <div className="row">
          <Button small variant="outline" to={ROUTES.editItem(item.id)}>
            Edit
          </Button>
          <Button small variant="outline" onClick={() => setConfirming(true)}>
            Take down
          </Button>
        </div>
      )}
      {error && (
        <p className="form-error" role="alert">
          {error}
        </p>
      )}
    </li>
  );
}

// Mock Up 21: the Give tab (people) or Items tab (organizations). Behind <RequireGiver>.
export default function MyItemsPage() {
  const location = useLocation();
  const navigate = useNavigate();
  const [items, setItems] = useState(null);
  const [error, setError] = useState("");
  // "Saved <name>." after an edit, shown once: clear it from history so a reload or Back doesn't repeat it.
  const [saved] = useState(location.state?.saved);

  useEffect(() => {
    if (location.state?.saved) navigate(location.pathname, { replace: true, state: null });
  }, [location, navigate]);

  useEffect(() => {
    api
      .listMyItems()
      .then(setItems)
      .catch((err) => setError(err.message));
  }, []);

  return (
    <section className="stack">
      <h1>My items</h1>
      {saved && <p role="status" className="saved">Saved {saved}.</p>}
      {error && (
        <p className="form-error" role="alert">
          Your items couldn't load. {error}
        </p>
      )}
      {!items && !error && <p>Loading…</p>}
      {items?.length === 0 && <NoteBox>You haven't posted anything yet. Post an item and families nearby can find it.</NoteBox>}
      {items?.length > 0 && (
        <ul className="item-list">
          {items.map((item) => (
            <ItemCard key={item.id} item={item} onTakenDown={(id) => setItems((xs) => xs.filter((i) => i.id !== id))} />
          ))}
        </ul>
      )}
      <Button to={ROUTES.postItem}>Post an item</Button>
    </section>
  );
}
