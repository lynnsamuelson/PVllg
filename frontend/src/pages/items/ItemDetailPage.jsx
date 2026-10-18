import { useEffect, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import * as api from "../../api/client.js";
import BackToResults from "../../components/BackToResults.jsx";
import Badge from "../../components/Badge.jsx";
import BottomSheet from "../../components/BottomSheet.jsx";
import BrandHeader from "../../components/BrandHeader.jsx";
import Button from "../../components/Button.jsx";
import FieldError from "../../components/FieldError.jsx";
import NoteBox from "../../components/NoteBox.jsx";
import { useAuth } from "../../context/AuthContext.jsx";
import { formatMiles, formatPickup } from "../../format.js";
import { ROUTES } from "../../routes.js";

// Keys match items.models.ItemReport.REASONS.
const REPORT_REASONS = [
  { value: "not_as_described", label: "Item isn't as described" },
  { value: "recalled_or_unsafe", label: "Item may be recalled or unsafe" },
  { value: "asked_personal_info", label: "Asked me to share personal information" },
  { value: "other", label: "Something else" },
];

// Mock Up 24: what's wrong with this item, in a bottom sheet over the item page. Sending doesn't change the item.
function ReportSheet({ itemId, onClose }) {
  const [reason, setReason] = useState("");
  const [error, setError] = useState("");
  const [fieldErrors, setFieldErrors] = useState({});
  const [sending, setSending] = useState(false);
  const [sent, setSent] = useState(false);

  const send = async (e) => {
    e.preventDefault();
    if (!reason) {
      setFieldErrors({ reason: ["Pick what's wrong."] });
      return;
    }
    setFieldErrors({});
    setError("");
    setSending(true);
    try {
      await api.reportItem(itemId, reason);
      setSent(true);
    } catch (err) {
      setFieldErrors(err.fields || {});
      setError(err.status ? `Your report wasn't sent. ${err.message}` : "Your report wasn't sent. Check your connection and try again.");
    }
    setSending(false);
  };

  return (
    <BottomSheet title="What's wrong?" onClose={onClose}>
      {sent ? (
        <p role="status" tabIndex={-1} ref={(el) => el?.focus()}>
          Thanks. Our team will review this.
        </p>
      ) : (
        <form onSubmit={send} className="stack" noValidate>
          <fieldset className="checkbox-list">
            <legend className="sr-only">What&apos;s wrong</legend>
            {REPORT_REASONS.map((r) => (
              <div key={r.value} className="checkbox-row">
                <label>
                  <input
                    type="radio"
                    name="report-reason"
                    value={r.value}
                    checked={reason === r.value}
                    onChange={() => setReason(r.value)}
                  />
                  {r.label}
                </label>
              </div>
            ))}
          </fieldset>
          <FieldError messages={fieldErrors.reason} />
          {error && (
            <p className="form-error" role="alert">
              {error}
            </p>
          )}
          <Button type="submit" disabled={sending}>
            Send report
          </Button>
        </form>
      )}
    </BottomSheet>
  );
}

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
  const { user } = useAuth();
  const [item, setItem] = useState(null);
  const [error, setError] = useState("");
  const [claiming, setClaiming] = useState(false);
  const [claimError, setClaimError] = useState("");
  const [reporting, setReporting] = useState(false);
  const navigate = useNavigate();

  useEffect(() => {
    let current = true;
    setItem(null);
    setError("");
    setReporting(false);
    api
      .getItem(itemId)
      .then((data) => current && setItem(data))
      .catch((err) => current && setError(err.status === 404 ? "This item isn't available anymore." : err.message));
    return () => {
      current = false;
    };
  }, [itemId]);

  const header = <BackToResults fallback={ROUTES.search} />;

  const claim = async () => {
    setClaiming(true);
    setClaimError("");
    try {
      await api.claimItem(item.id);
      navigate(ROUTES.claims);
    } catch (err) {
      setClaimError(err.message);
      setClaiming(false);
      api.getItem(item.id).then(setItem).catch(() => {}); // show what's left now, e.g. none after a lost race
    }
  };

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
          <h2>{available ? `${item.left} left` : "Not available"}</h2>
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
        {user.account_type === "organization" && !item.mine ? null : item.mine ? (
          <Button variant="outline" to={ROUTES.editItem(item.id)}>
            This is your item. Edit it
          </Button>
        ) : (
          <>
            {claimError && (
              <p className="form-error" role="alert">
                {claimError}
              </p>
            )}
            <Button disabled={!available || claiming} onClick={claim}>
              {org ? "Claim one (held for 3 days)" : "Request to claim"}
            </Button>
            <button type="button" className="text-link centered" onClick={() => setReporting(true)}>
              Report a problem
            </button>
          </>
        )}
      </div>
      {reporting && <ReportSheet itemId={item.id} onClose={() => setReporting(false)} />}
    </section>
  );
}
