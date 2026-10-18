import { useEffect, useState } from "react";
import { Link, useParams } from "react-router-dom";
import * as api from "../../api/client.js";
import BrandHeader from "../../components/BrandHeader.jsx";
import Checkbox from "../../components/Checkbox.jsx";
import NoteBox from "../../components/NoteBox.jsx";
import { formatPickup } from "../../format.js";
import { ROUTES } from "../../routes.js";

// Mock Up 16. The calendar file comes from the API, which applies the privacy rule (KAN-11): before a person's item
// is approved, the event has the general area, not the exact place. Reminders come from the family's own calendar app.
export default function AddToCalendarPage() {
  const { claimId } = useParams();
  const [claim, setClaim] = useState(null);
  const [error, setError] = useState("");
  const [dayBefore, setDayBefore] = useState(true);
  const [hourBefore, setHourBefore] = useState(true);

  useEffect(() => {
    let current = true;
    api
      .getClaim(claimId)
      .then((data) => current && setClaim(data))
      .catch((err) =>
        current && setError(err.status === 404 ? "Only an approved claim can go in your calendar." : err.message)
      );
    return () => {
      current = false;
    };
  }, [claimId]);

  const back = (
    <Link to={ROUTES.claims} className="back-link">
      ← My claims
    </Link>
  );
  if (error) {
    return (
      <section className="stack">
        {back}
        <p className="form-error" role="alert">
          {error}
        </p>
      </section>
    );
  }
  if (!claim) {
    return (
      <section className="stack">
        {back}
        <p role="status">Loading…</p>
      </section>
    );
  }

  const { item } = claim;
  const reminders = [...(dayBefore ? ["day"] : []), ...(hourBefore ? ["hour"] : [])];
  const { where, notes } = claim.event; // exactly what the calendar file holds
  return (
    <section>
      {back}
      <BrandHeader />
      <div className="stack">
        <h1 className="item-title">Add to your calendar</h1>
        <p className="item-giver">Never forget a pickup. The event includes everything you need.</p>
        <div className="card claim-card approved">
          <h2>Pick up: {item.name}</h2>
          <p>
            <strong>When:</strong> {formatPickup(item)}
          </p>
          <p>
            <strong>Where:</strong> {where}
          </p>
          {notes && (
            <p>
              <strong>Notes:</strong> {notes}
            </p>
          )}
        </div>
        <fieldset className="checkbox-list">
          <legend className="field-label">Remind me</legend>
          <Checkbox label="1 day before" checked={dayBefore} onChange={setDayBefore} />
          <Checkbox label="1 hour before" checked={hourBefore} onChange={setHourBefore} />
        </fieldset>
        {/* Opening the file hands it to the phone's calendar app; downloading saves it to import anywhere. Plain links
            styled as buttons, because <Button to> is a router link and can't serve an /api file. */}
        <a className="btn btn-primary" href={api.calendarUrl(claim.id, { reminders })}>
          Add to calendar
        </a>
        <a className="btn btn-outline" href={api.calendarUrl(claim.id, { reminders, download: true })} download>
          Download calendar file
        </a>
        <NoteBox>For an item from a person, the exact place is added only after the giver approves.</NoteBox>
      </div>
    </section>
  );
}
