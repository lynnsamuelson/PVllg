import { useEffect, useState } from "react";
import { useSearchParams } from "react-router-dom";
import * as api from "../../api/client.js";
import Badge from "../../components/Badge.jsx";
import BrandHeader from "../../components/BrandHeader.jsx";
import Button from "../../components/Button.jsx";
import NoteBox from "../../components/NoteBox.jsx";
import Tabs from "../../components/Tabs.jsx";
import { useAuth } from "../../context/AuthContext.jsx";
import { formatPickup } from "../../format.js";
import { ROUTES } from "../../routes.js";

const TABS = [
  { value: "active", label: "Active" },
  { value: "past", label: "Past" },
];
const STATUS = {
  approved: { label: "Approved", badge: "verified" },
  waiting: { label: "Waiting", badge: "pending" },
  declined: { label: "Declined", badge: "pending" },
  canceled: { label: "Canceled", badge: "pending" },
  ended: { label: "Ended", badge: "pending" },
  picked_up: { label: "Picked up", badge: "verified" },
};

// Why a claim is in Past (KAN-14). Keys match claims.models.Claim.REASONS and its statuses.
const ENDED_BECAUSE = {
  hold_ended: "The hold ended.",
  no_answer: "The giver didn't answer in time.",
  no_show: "The giver marked it not picked up.",
  problem: "You reported a problem.",
};
// null when the badge (Canceled, Picked up) already says it all.
export function pastReason(claim) {
  if (claim.status === "declined") return "The giver declined.";
  if (claim.status !== "ended") return null;
  return Object.hasOwn(ENDED_BECAUSE, claim.end_reason) ? ENDED_BECAUSE[claim.end_reason] : "This claim ended.";
}

// "Hold ends in 3 days", "Hold ends today" (under a day left) or "Hold has ended", from the claim's held_until.
export function holdLine(heldUntil, now = new Date()) {
  const hours = (new Date(heldUntil) - now) / (60 * 60 * 1000);
  if (hours <= 0) return "Hold has ended";
  if (hours < 24) return "Hold ends today";
  const days = Math.round(hours / 24);
  return `Hold ends in ${days} ${days === 1 ? "day" : "days"}`;
}

function ClaimCard({ claim, onChanged }) {
  const [confirming, setConfirming] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const { item } = claim;
  const status = Object.hasOwn(STATUS, claim.status) ? STATUS[claim.status] : STATUS.ended;
  const active = claim.status === "approved" || claim.status === "waiting";

  const cancel = async () => {
    setBusy(true);
    setError("");
    try {
      onChanged(await api.cancelClaim(claim.id));
    } catch (err) {
      setError(`Your claim wasn't canceled. ${err.message}`);
      setBusy(false);
    }
  };

  return (
    <li className={`card claim-card${claim.status === "approved" ? " approved" : ""}`}>
      <h2>
        {item.name} <Badge variant={status.badge}>{status.label}</Badge>
      </h2>
      {active && claim.held_until && <p>{holdLine(claim.held_until)}</p>}
      {claim.status === "approved" && claim.pickup_changed && (
        <div role="status">
          <NoteBox>Pickup details changed. Update your calendar.</NoteBox>
        </div>
      )}
      {claim.status === "approved" && (
        <>
          <p>{formatPickup(item)}</p>
          {/* The privacy rule (KAN-11) sends the exact place only once a claim is Approved. */}
          <p>{item.exact_address || item.general_area}</p>
          {item.where_to_go && <p>{item.where_to_go}</p>}
        </>
      )}
      {claim.status === "waiting" && <p>The giver hasn&apos;t answered yet. Exact pickup details appear after approval.</p>}
      {!active && pastReason(claim) && <p>{pastReason(claim)}</p>}
      {active &&
        (confirming ? (
          <div className="stack">
            <p>Cancel your claim? The item goes back on the list for other families.</p>
            <div className="row">
              <Button small onClick={cancel} disabled={busy}>
                Yes, cancel
              </Button>
              <Button small variant="outline" onClick={() => setConfirming(false)} disabled={busy}>
                Keep it
              </Button>
            </div>
          </div>
        ) : (
          <div className="stack">
            {claim.status === "approved" && (
              <Button small to={ROUTES.claimCalendar(claim.id)}>
                Add to calendar
              </Button>
            )}
            {claim.can_report && (
              <Button small variant="outline" to={ROUTES.claimReport(claim.id)}>
                Problem with pickup
              </Button>
            )}
            <Button small variant="outline" onClick={() => setConfirming(true)}>
              Cancel claim
            </Button>
          </div>
        ))}
      {error && (
        <p className="form-error" role="alert">
          {error}
        </p>
      )}
    </li>
  );
}

// Mock Up 15: the Claims tab. Active shows Waiting and Approved claims; Past shows ended ones.
export default function MyClaimsPage() {
  const { user } = useAuth();
  const [params, setParams] = useSearchParams();
  const tab = params.get("tab") === "past" ? "past" : "active";
  const [claims, setClaims] = useState(null);
  const [error, setError] = useState("");
  const isOrg = user.account_type === "organization";

  useEffect(() => {
    if (isOrg) return undefined;
    let current = true;
    setClaims(null);
    setError("");
    api
      .listClaims(tab)
      .then((data) => current && setClaims(data))
      .catch((err) => current && setError(err.message));
    return () => {
      current = false;
    };
  }, [tab, isOrg]);

  if (isOrg) {
    return (
      <section className="stack">
        <h1>Claims</h1>
        <NoteBox>Families&apos; claims on your items show on My items.</NoteBox>
        <Button to={ROUTES.orgItems}>My items</Button>
      </section>
    );
  }

  // A canceled claim leaves Active right away.
  const changed = (claim) => setClaims((list) => list.filter((c) => c.id !== claim.id));

  return (
    <section>
      <h1>My claims</h1>
      <BrandHeader />
      <div className="stack">
        <Tabs
          label="Which claims"
          tabs={TABS}
          value={tab}
          onChange={(value) => setParams(value === "past" ? { tab: "past" } : {}, { replace: true })}
        />
        {error && (
          <p className="form-error" role="alert">
            Your claims couldn&apos;t load. {error}
          </p>
        )}
        {!claims && !error && <p role="status">Loading…</p>}
        {claims?.length === 0 &&
          (tab === "active" ? (
            <>
              <NoteBox>You have no claims right now. Find items near you in Search.</NoteBox>
              <Button to={ROUTES.search}>Search near me</Button>
            </>
          ) : (
            <NoteBox>Claims you finish or cancel show here.</NoteBox>
          ))}
        {claims?.length > 0 && (
          <ul className="item-list">
            {claims.map((claim) => (
              <ClaimCard key={claim.id} claim={claim} onChanged={changed} />
            ))}
          </ul>
        )}
        {tab === "active" && (
          <NoteBox>If you don&apos;t pick up by the deadline, the item goes back on the list for other families.</NoteBox>
        )}
      </div>
    </section>
  );
}
