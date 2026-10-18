import { useEffect, useState } from "react";
import { Link, useParams } from "react-router-dom";
import * as api from "../../api/client.js";
import BrandHeader from "../../components/BrandHeader.jsx";
import Button from "../../components/Button.jsx";
import FieldError from "../../components/FieldError.jsx";
import TextField from "../../components/TextField.jsx";
import { formatDate } from "../../format.js";
import { ROUTES } from "../../routes.js";

// Keys match claims.models.PickupReport.REASONS. One reason, no chat (KAN-20).
const REASONS = [
  { value: "not_there", label: "The item wasn't there" },
  { value: "nobody_or_wrong_place", label: "Nobody was there, or the place was wrong" },
  { value: "not_as_described", label: "The item isn't what was described" },
  { value: "damaged_or_unsafe", label: "The item looks damaged or unsafe" },
  { value: "felt_unsafe", label: "I felt uncomfortable or unsafe" },
  { value: "other", label: "Something else" },
];
const NOTE_MAX = 200;

// "Find similar items nearby" opens Search on the chip the API picked for the item's category.
function Sent({ reason, chip }) {
  return (
    <div className="stack">
      <h1 className="item-title">Thank you. We&apos;re sorry this happened.</h1>
      <div className="card claim-card approved">
        <h2>What happens next</h2>
        <p>Your claim is released.</p>
        <p>The giver is told the reason you chose.</p>
        <p>The item is paused until the giver confirms it is available.</p>
        <p>Our team reviews every report.</p>
      </div>
      <div className="card detail-card">
        <h2>What the giver sees</h2>
        <p>&quot;A family reported: {reason}.&quot; Your name and note are not shared.</p>
      </div>
      <Button to={chip ? `${ROUTES.search}?category=${chip}` : ROUTES.search}>Find similar items nearby</Button>
      <Button variant="outline" to={ROUTES.claims}>
        Back to My claims
      </Button>
    </div>
  );
}

// Mock Ups 17 (report) and 18 (after the report).
export default function ReportProblemPage() {
  const { claimId } = useParams();
  const [claim, setClaim] = useState(null);
  const [loadError, setLoadError] = useState("");
  const [reason, setReason] = useState("");
  const [note, setNote] = useState("");
  const [errors, setErrors] = useState({});
  const [sendError, setSendError] = useState("");
  const [sending, setSending] = useState(false);
  const [sent, setSent] = useState(null);

  useEffect(() => {
    let current = true;
    api
      .getClaim(claimId)
      .then((data) => {
        if (!current) return;
        if (data.can_report) setClaim(data);
        else setLoadError("You can report a problem from the start of the pickup window until a day after it ends.");
      })
      .catch((err) => current && setLoadError(err.status === 404 ? "This claim isn't approved anymore." : err.message));
    return () => {
      current = false;
    };
  }, [claimId]);

  const send = async (e) => {
    e.preventDefault();
    if (!reason) {
      setErrors({ reason: ["Pick what happened."] });
      return;
    }
    setErrors({});
    setSendError("");
    setSending(true);
    try {
      setSent(await api.reportProblem(claimId, reason, note.trim()));
    } catch (err) {
      setErrors(err.fields || {});
      setSendError(`Your report wasn't sent. ${err.message}`);
      setSending(false);
    }
  };

  const back = (
    <Link to={ROUTES.claims} className="back-link">
      ← My claims
    </Link>
  );
  if (loadError && !sent) {
    return (
      <section className="stack">
        {back}
        <p className="form-error" role="alert">
          {loadError}
        </p>
      </section>
    );
  }
  if (!claim && !sent) {
    return (
      <section className="stack">
        {back}
        <p role="status">Loading…</p>
      </section>
    );
  }

  return (
    <section>
      {back}
      <BrandHeader />
      {sent ? (
        <Sent reason={sent.reason} chip={sent.chip} />
      ) : (
        <form onSubmit={send} className="stack" noValidate>
          <h1 className="item-title">What happened at pickup?</h1>
          <p className="item-giver">
            {claim.item.name} · {formatDate(claim.item.pickup_date)}
          </p>
          <fieldset className="checkbox-list">
            <legend className="sr-only">What happened</legend>
            {REASONS.map((r) => (
              <div key={r.value} className="checkbox-row">
                <label>
                  <input
                    type="radio"
                    name="reason"
                    value={r.value}
                    checked={reason === r.value}
                    onChange={() => setReason(r.value)}
                  />
                  {r.label}
                </label>
              </div>
            ))}
          </fieldset>
          <FieldError messages={errors.reason} />
          <TextField
            label="Short note (optional)"
            multiline
            rows={3}
            maxLength={NOTE_MAX}
            placeholder={`Up to ${NOTE_MAX} characters`}
            value={note}
            onChange={(e) => setNote(e.target.value)}
            hint="Please don't include phone numbers or addresses."
            errors={errors.note}
          />
          {sendError && (
            <p className="form-error" role="alert">
              {sendError}
            </p>
          )}
          <Button type="submit" disabled={sending}>
            Send report
          </Button>
          <p className="result-card-line centered-text">In an emergency, call 911.</p>
        </form>
      )}
    </section>
  );
}
