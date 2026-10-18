import { useEffect, useState } from "react";
import { Link, Navigate } from "react-router-dom";
import * as api from "../../api/client.js";
import AppHeader from "../../components/AppHeader.jsx";
import Badge from "../../components/Badge.jsx";
import Button from "../../components/Button.jsx";
import NoteBox from "../../components/NoteBox.jsx";
import { useAuth } from "../../context/AuthContext.jsx";
import { formatMiles } from "../../format.js";
import { ROUTES } from "../../routes.js";

// The journey line and need chips from the person's own answers (KAN-6 keys).
const STAGE = { expecting: "Expecting", parenting: "Parenting", both: "Expecting and parenting" };
const AGE = {
  under_3mo: "baby under 3 months",
  "3_12mo": "baby 3-12 months",
  "1_2yrs": "toddler 1-2 years",
  "3_5yrs": "child 3-5 years",
};
const NEED = { essentials: "Diapers", feeding: "Feeding", parenting: "Parenting", housing: "Housing" };
const named = (map, key) => (Object.hasOwn(map, key) ? map[key] : key);

export function journeyLine(profile) {
  const ages = profile.ages.map((a) => named(AGE, a));
  return [named(STAGE, profile.stage), ...ages].join(", ");
}

function ItemCard({ item }) {
  return (
    <Link to={ROUTES.item(item.id)} state={{ fromList: true }} className="card result-card">
      <h2>{item.name}</h2>
      <p className="result-card-line">
        {item.giver}{" "}
        {item.from_organization ? <Badge variant="verified">Verified</Badge> : <Badge variant="person">Person</Badge>}
        {item.demo && (
          <>
            {" "}
            <Badge variant="demo">Demo</Badge>
          </>
        )}{" "}
        · {formatMiles(item.distance_miles, { lower: true })}
      </p>
    </Link>
  );
}

function ResourceCard({ resource }) {
  return (
    <Link to={ROUTES.resource(resource.id)} state={{ fromList: true }} className="card result-card">
      <h2>{resource.title}</h2>
      <p className="result-card-line">
        {resource.category}
        {resource.referral && ` · ${resource.referral}`}
      </p>
    </Link>
  );
}

// Mock Up 11: the first screen after sign in, built from the person's own answers. "For you right now" is the
// nearest item and the best resource match (KAN-16).
export default function HomePage() {
  const { user } = useAuth();
  const [picks, setPicks] = useState(null);
  const [error, setError] = useState("");
  const isOrg = user.account_type === "organization";
  const profile = user.profile;
  const gets = user.gets !== false; // Get support off: no picks or Search, like the bottom bar (KAN-24)

  useEffect(() => {
    if (isOrg || !profile || !gets) return undefined;
    let current = true;
    setPicks(null);
    setError("");
    // The same 10 miles Search opens with; one failing request doesn't hide the other's pick.
    Promise.allSettled([api.searchItems(), api.getResourceMatches(profile)]).then(([items, resources]) => {
      if (!current) return;
      if (items.status === "rejected" && resources.status === "rejected") {
        setError(items.reason.message);
        return;
      }
      setPicks({
        item: items.status === "fulfilled" ? items.value[0] : null,
        // Only a resource that fits one of their needs counts as "for you".
        resource: resources.status === "fulfilled" ? resources.value.find((r) => r.matches_needs) : null,
      });
    });
    return () => {
      current = false;
    };
  }, [isOrg, profile, gets]);

  // Organizations start on their Items tab.
  if (isOrg) return <Navigate to={ROUTES.orgItems} replace />;

  const firstName = (user.name || "").trim().split(/\s+/)[0];
  return (
    <section className="stack">
      <AppHeader>PVill</AppHeader>
      <h1 className="item-title">{firstName ? `Welcome, ${firstName}` : "Welcome"}</h1>
      {!profile ? (
        <>
          <NoteBox>Set up your profile so we can show you things near you.</NoteBox>
          <Button to={ROUTES.profileSetup}>Set up your profile</Button>
        </>
      ) : (
        <>
          <p className="item-giver">{profile.area}</p>
          <div className="card detail-card">
            <h2>Your journey</h2>
            <p>{journeyLine(profile)}</p>
            <div className="chips">
              {profile.needs.map((n) => (
                <span key={n} className="chip selected">
                  {named(NEED, n)}
                </span>
              ))}
            </div>
          </div>
          {gets && (
            <>
              <p className="field-label">For you right now</p>
              {error && (
                <p className="form-error" role="alert">
                  Suggestions couldn&apos;t load. {error}
                </p>
              )}
              {!picks && !error && <p role="status">Loading…</p>}
              {picks && !picks.item && !picks.resource && (
                <NoteBox>Nothing near you just yet. Search to see everything, or try a wider distance.</NoteBox>
              )}
              {picks?.item && <ItemCard item={picks.item} />}
              {picks?.resource && <ResourceCard resource={picks.resource} />}
            </>
          )}
          <div className="row">
            {gets && (
              <>
                <Button small to={`${ROUTES.search}?tab=resources`}>
                  Find resources
                </Button>
                <Button small variant="outline" to={ROUTES.search}>
                  See items
                </Button>
              </>
            )}
            {user.gives && (
              <Button small variant="outline" to={ROUTES.give}>
                My items
              </Button>
            )}
          </div>
        </>
      )}
    </section>
  );
}
