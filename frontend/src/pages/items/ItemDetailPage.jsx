import { useEffect, useState } from "react";
import { useLocation, useNavigate, useParams } from "react-router-dom";
import * as api from "../../api/client.js";
import Badge from "../../components/Badge.jsx";
import BrandHeader from "../../components/BrandHeader.jsx";
import Button from "../../components/Button.jsx";
import NoteBox from "../../components/NoteBox.jsx";
import { formatMiles, formatPickup } from "../../format.js";
import { ROUTES } from "../../routes.js";

// "Private. The exact pickup place..." with its first sentence ("Private.") in bold, as on Mock Up 14.
function boldLabel(note) {
  const [label, ...rest] = note.split(/(?<=\.) /);
  return rest.length ? (
    <>
      <strong>{label}</strong> {rest.join(" ")}
    </>
  ) : (
    note
  );
}

// Mock Ups 13 (organization) and 14 (person). The privacy rule (KAN-11) decides what the API sends: a person's item
// has no exact address until an approved claim, so this page only shows what it gets.
export default function ItemDetailPage() {
  const { itemId } = useParams();
  const navigate = useNavigate();
  const location = useLocation();
  const [item, setItem] = useState(null);
  const [error, setError] = useState("");

  useEffect(() => {
    let current = true;
    setItem(null);
    setError("");
    api
      .getItem(itemId)
      .then((data) => current && setItem(data))
      .catch((err) => current && setError(err.status === 404 ? "This item isn't available anymore." : err.message));
    return () => {
      current = false;
    };
  }, [itemId]);

  // Back to the results with the same search when Search opened this page; otherwise to Search.
  const back = () => (location.state?.fromSearch ? navigate(-1) : navigate(ROUTES.search));
  const header = (
    <button type="button" className="back-link" onClick={back}>
      ← Results
    </button>
  );

  if (error) {
    return (
      <section className="stack">
        {header}
        <p className="form-error" role="alert">
          {error}
        </p>
      </section>
    );
  }
  if (!item) {
    return (
      <section className="stack">
        {header}
        <p role="status">Loading…</p>
      </section>
    );
  }

  const org = item.from_organization;
  const { available } = item; // some left and the pickup day hasn't passed
  return (
    <section>
      {header}
      {!org && <BrandHeader />}
      <div className="stack">
        <h1 className="item-title">{item.name}</h1>
        <p className="item-giver">
          {item.giver}{" "}
          {org ? <Badge variant="verified">Verified</Badge> : <Badge variant="person">Person</Badge>}
          {item.demo && (
            <>
              {" "}
              <Badge variant="demo">Demo</Badge>
            </>
          )}
        </p>
        {item.photos.length > 0 && (
          <ul className="item-photos">
            {item.photos.map((src, i) => (
              <li key={src}>
                <img src={src} alt={`${item.name}, photo ${i + 1}`} />
              </li>
            ))}
          </ul>
        )}
        <div className="card detail-card">
          <h2>{available ? `${item.quantity} left` : "Not available"}</h2>
          <p>{item.details}</p>
        </div>
        <p className="checked-row">
          <span className="checked-box" aria-hidden="true">
            ✓
          </span>
          Giver confirmed: good condition, not recalled
        </p>
        <div className="card detail-card">
          <h2>{org ? "Pickup" : "Pickup window"}</h2>
          <p>{formatPickup(item)}</p>
          {item.exact_address ? (
            <p>
              {item.exact_address}
              {org && " (organization address)"}
            </p>
          ) : (
            <p>
              {item.general_area}
              {item.distance_miles != null && ` · ${formatMiles(item.distance_miles, { lower: true })}`}
            </p>
          )}
          {item.where_to_go && <p>{item.where_to_go}</p>}
          {item.what_to_bring && <p>{item.what_to_bring}</p>}
        </div>
        {item.private_note && <NoteBox>{boldLabel(item.private_note)}</NoteBox>}
        {item.mine ? (
          <Button variant="outline" to={ROUTES.editItem(item.id)}>
            This is your item. Edit it
          </Button>
        ) : (
          <>
            {/* Claiming is built in KAN-12 and the Report sheet in KAN-22; until then they show but do nothing. */}
            <Button disabled={!available}>{org ? "Claim one (held for 3 days)" : "Request to claim"}</Button>
            <button type="button" className="text-link centered">
              Report a problem
            </button>
          </>
        )}
      </div>
    </section>
  );
}
