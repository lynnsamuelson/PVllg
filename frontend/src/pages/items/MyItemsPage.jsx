import { useEffect, useState } from "react";
import { useLocation, useNavigate } from "react-router-dom";
import * as api from "../../api/client.js";
import Button from "../../components/Button.jsx";
import NoteBox from "../../components/NoteBox.jsx";
import { useAuth } from "../../context/AuthContext.jsx";
import { ROUTES } from "../../routes.js";

// "1 listed · 1 requested", "0 left · 1 claimed", "2 left" (Mock Up 21). Never below zero.
export function countsLine(item) {
  const left = Math.max(item.left, 0);
  if (item.requested === 0) return [`${left} left`, ...(item.claimed > 0 ? [`${item.claimed} claimed`] : [])].join(" · ");
  const parts = [`${item.quantity} listed`, `${item.requested} requested`];
  if (item.claimed > 0) parts.push(`${item.claimed} claimed`);
  if (left > 0) parts.push(`${left} left`);
  return parts.join(" · ");
}

// A family's claim on this item, as the giver sees it: a Waiting request to answer (Mock Up 21) or an Approved
// claim to mark picked up. Only the family's first name ever shows.
function ClaimRow({ claim, onAnswered }) {
  const [busy, setBusy] = useState(false);
  const [confirmingNoShow, setConfirmingNoShow] = useState(false);
  const [error, setError] = useState("");

  const answer = async (call) => {
    setBusy(true);
    setError("");
    try {
      await call(claim.id);
      await onAnswered();
    } catch (err) {
      setError(err.message);
    }
    setBusy(false);
  };

  return (
    <div className="stack">
      {claim.status === "waiting" ? (
        <>
          <div className="note-box request-box">
            <strong>{claim.family}</strong>
            <span>wants this item.</span>
            <span>Approving shares your exact pickup details.</span>
          </div>
          <div className="row">
            <Button small onClick={() => answer(api.approveClaim)} disabled={busy}>
              Approve
            </Button>
            <Button small variant="outline" onClick={() => answer(api.declineClaim)} disabled={busy}>
              Decline
            </Button>
          </div>
        </>
      ) : (
        <div className="stack">
          <span className="claim-row">Approved for {claim.family}</span>
          {confirmingNoShow ? (
            <div className="stack">
              <p>{claim.family}&apos;s claim ends and the item goes back on the list. This can&apos;t be undone.</p>
              <div className="row">
                <Button small onClick={() => answer(api.familyDidntCome)} disabled={busy}>
                  Yes, they didn&apos;t come
                </Button>
                <Button small variant="outline" onClick={() => setConfirmingNoShow(false)} disabled={busy}>
                  Keep it
                </Button>
              </div>
            </div>
          ) : (
            <div className="stack">
              <Button small variant="outline" onClick={() => answer(api.markPickedUp)} disabled={busy}>
                Mark picked up
              </Button>
              <Button small variant="outline" onClick={() => setConfirmingNoShow(true)} disabled={busy}>
                Family didn&apos;t come
              </Button>
            </div>
          )}
        </div>
      )}
      {error && (
        <p className="form-error" role="alert">
          {error}
        </p>
      )}
    </div>
  );
}

// A family reported a pickup problem (KAN-20): the item is out of search until the giver says it's still there.
// Not in the mockups yet (KAN-4), so it's built from the shared NoteBox and Button.
function PausedNotice({ item, onChanged }) {
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  const available = async () => {
    setBusy(true);
    setError("");
    try {
      await api.markAvailable(item.id);
      await onChanged();
    } catch (err) {
      setError(err.message);
    }
    setBusy(false);
  };

  return (
    <div className="stack">
      <NoteBox>
        <strong>Paused.</strong> A family reported: &quot;{item.paused}.&quot;
      </NoteBox>
      <Button small onClick={available} disabled={busy}>
        Yes, it is available
      </Button>
      {error && (
        <p className="form-error" role="alert">
          {error}
        </p>
      )}
    </div>
  );
}

function ItemCard({ item, onTakenDown, onChanged }) {
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
      {item.paused && <PausedNotice item={item} onChanged={onChanged} />}
      {item.claims.map((claim) => (
        <ClaimRow key={`${claim.id}-${claim.status}`} claim={claim} onAnswered={onChanged} />
      ))}
      {/* Edit stays, so a giver can change pickup details after a claim (KAN-19). As on Mock Up 21, an item with open
          requests or claims is answered first, not taken down. */}
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
          {item.claims.length === 0 && (
            <Button small variant="outline" onClick={() => setConfirming(true)}>
              Take down
            </Button>
          )}
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
  const { user } = useAuth();
  const canPost = user.account_type === "organization" || user.gives;
  const location = useLocation();
  const navigate = useNavigate();
  const [items, setItems] = useState(null);
  const [error, setError] = useState("");
  // "Saved <name>." after an edit, shown once: clear it from history so a reload or Back doesn't repeat it.
  const [saved] = useState(location.state?.saved);

  useEffect(() => {
    if (location.state?.saved) navigate(location.pathname, { replace: true, state: null });
  }, [location, navigate]);

  const load = () =>
    api
      .listMyItems()
      .then((data) => {
        setItems(data);
        setError("");
      })
      .catch((err) => setError(err.message));

  useEffect(() => {
    load();
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
            <ItemCard
              key={item.id}
              item={item}
              onTakenDown={(id) => setItems((xs) => xs.filter((i) => i.id !== id))}
              onChanged={load}
            />
          ))}
        </ul>
      )}
      {canPost ? (
        <Button to={ROUTES.postItem}>Post an item</Button>
      ) : (
        <NoteBox>Give support is off, so you can't post new items. Turn it on in Profile.</NoteBox>
      )}
    </section>
  );
}
