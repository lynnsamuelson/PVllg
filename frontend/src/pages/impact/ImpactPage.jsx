import { useEffect, useState } from "react";
import * as api from "../../api/client.js";
import AppHeader from "../../components/AppHeader.jsx";
import Badge from "../../components/Badge.jsx";
import NoteBox from "../../components/NoteBox.jsx";
import { useAuth } from "../../context/AuthContext.jsx";

const TILES = [
  { key: "families_helped", label: "Families helped" },
  { key: "items_posted", label: "Items posted" },
  { key: "items_claimed", label: "Items claimed" },
  { key: "items_picked_up", label: "Items picked up" },
  { key: "returned_to_list", label: "Returned to the list" },
  { key: "estimated_savings", label: "Estimated savings", money: true },
];

// Mock Up 10: the Impact tab for organizations, the last 30 days. Made-up numbers (the demo organizations) say
// Example data; savings are estimates.
export default function ImpactPage() {
  const { user } = useAuth();
  const [numbers, setNumbers] = useState(null);
  const [error, setError] = useState("");
  const isOrg = user.account_type === "organization";

  useEffect(() => {
    if (!isOrg) return;
    api
      .getImpact()
      .then(setNumbers)
      .catch((err) => setError(err.message));
  }, [isOrg]);

  if (!isOrg) {
    return (
      <section className="stack">
        <AppHeader>Impact</AppHeader>
        <NoteBox>Impact numbers are for organizations.</NoteBox>
      </section>
    );
  }

  return (
    <section className="stack">
      <div className="app-header-row">
        <AppHeader>Impact</AppHeader>
        {numbers?.demo && <Badge variant="demo">Example data</Badge>}
      </div>
      {error && (
        <p className="form-error" role="alert">
          Your impact numbers couldn&apos;t load. {error}
        </p>
      )}
      {!numbers && !error && <p role="status">Loading…</p>}
      {numbers && (
        <>
          <p className="item-giver">{numbers.organization}, last 30 days</p>
          {TILES.every((t) => numbers[t.key] === 0) && (
            <NoteBox>Nothing yet in the last 30 days. When families pick up your items, the numbers show here.</NoteBox>
          )}
          <ul className="impact-tiles">
            {TILES.map((t) => (
              <li key={t.key} className="card impact-tile">
                <strong>{t.money ? `$${numbers[t.key].toLocaleString("en-US")}` : numbers[t.key]}</strong>
                <span>{t.label}</span>
              </li>
            ))}
          </ul>
          <NoteBox>A family counts once, after pickup is confirmed. Savings are estimates using a set value per item type.</NoteBox>
        </>
      )}
    </section>
  );
}
