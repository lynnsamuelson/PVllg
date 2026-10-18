import { useEffect, useRef, useState } from "react";
import { Link, useSearchParams } from "react-router-dom";
import * as api from "../../api/client.js";
import Badge from "../../components/Badge.jsx";
import Button from "../../components/Button.jsx";
import Chip from "../../components/Chip.jsx";
import NoteBox from "../../components/NoteBox.jsx";
import Tabs from "../../components/Tabs.jsx";
import { useAuth } from "../../context/AuthContext.jsx";
import { ROUTES } from "../../routes.js";

const TABS = [
  { value: "items", label: "Items" },
  { value: "resources", label: "Resources" },
];
// Keys match the API: items.serializers.CHIP_CATEGORIES and resources.models.CATEGORIES.
const CHIPS = [
  { value: "", label: "All" },
  { value: "essentials", label: "Essentials" },
  { value: "feeding", label: "Feeding" },
  { value: "parenting", label: "Parenting" },
  { value: "housing", label: "Housing" },
];
const RADII = ["5", "10", "25", "50"];
const TAB_VALUES = new Set(TABS.map((t) => t.value));
const CHIP_VALUES = new Set(CHIPS.map((c) => c.value));
const TYPING_PAUSE_MS = 300;

// Whole miles, at least 1, so nothing reads as "About 0 miles".
const about = (miles) => {
  const shown = Math.max(1, miles);
  return `About ${shown} ${shown === 1 ? "mile" : "miles"}`;
};

function ItemCard({ item }) {
  return (
    <li>
      <Link to={ROUTES.item(item.id)} className="card result-card">
        <h2>{item.name}</h2>
        <p className="result-card-line">
          {item.from_organization ? item.giver : "A parent nearby"}{" "}
          {item.from_organization ? <Badge variant="verified">Verified</Badge> : <Badge variant="person">Person</Badge>}
          {item.demo && (
            <>
              {" "}
              <Badge variant="demo">Demo</Badge>
            </>
          )}
        </p>
        <p className="result-card-line">
          {about(item.distance_miles)} · {item.quantity} left
        </p>
      </Link>
    </li>
  );
}

// Statewide and national programs are never called nearby; local ones show a rounded distance or their area.
function resourceArea(r) {
  if (r.area_type === "statewide") return "Statewide";
  if (r.area_type === "national") return "National";
  return r.distance_miles != null ? about(r.distance_miles) : r.area_served || "Area not listed";
}

function ResourceCard({ resource }) {
  return (
    <li>
      <Link to={ROUTES.resource(resource.id)} className="card result-card">
        <h2>{resource.title}</h2>
        <p className="result-card-line">
          {resource.category} · {resourceArea(resource)}
        </p>
        {resource.limits && <p className="result-card-line">{resource.limits}</p>}
      </Link>
    </li>
  );
}

// Mock Up 12. The words, tab, chip and distance live in the URL, so Back from a details screen keeps them.
export default function SearchPage() {
  const { user } = useAuth();
  const [params, setParams] = useSearchParams();
  const tab = TAB_VALUES.has(params.get("tab")) ? params.get("tab") : "items";
  const category = CHIP_VALUES.has(params.get("category")) ? params.get("category") : "";
  const radius = RADII.includes(params.get("radius")) ? params.get("radius") : "10";
  const q = params.get("q") || "";
  const [typed, setTyped] = useState(q);
  const sentQ = useRef(q); // the words this page last put in the URL
  const [found, setFound] = useState(null); // { key, results } for the search that produced them
  const [error, setError] = useState("");
  const [attempt, setAttempt] = useState(0);
  const profile = user.profile;
  const key = [tab, q, category, radius].join("|");
  const results = found?.key === key ? found.results : null; // never show one tab's results on another
  const housingItems = tab === "items" && category === "housing"; // no items are housing; it's all resources

  const update = (changes) =>
    setParams(
      (current) => {
        const next = new URLSearchParams(current);
        for (const [key, value] of Object.entries(changes)) {
          if (value) next.set(key, value);
          else next.delete(key);
        }
        return next;
      },
      { replace: true }
    );

  // The URL changed some other way (the Search tab, Back): show its words in the box.
  useEffect(() => {
    if (q !== sentQ.current) {
      sentQ.current = q;
      setTyped(q);
    }
  }, [q]);

  useEffect(() => {
    const words = typed.trim();
    if (words === q) return undefined;
    const timer = setTimeout(() => {
      sentQ.current = words;
      update({ q: words });
    }, TYPING_PAUSE_MS);
    return () => clearTimeout(timer);
  }, [typed]); // only typing starts the pause; q catching up must not restart it

  useEffect(() => {
    if (!profile?.zip || housingItems) return undefined;
    let current = true;
    setError("");
    const request =
      tab === "items"
        ? api.searchItems({ q, category, radius })
        : api.getResourceMatches(profile, { q, category, radius });
    request
      .then((data) => current && setFound({ key, results: data }))
      .catch((err) => current && setError(err.message));
    return () => {
      current = false;
    };
  }, [key, profile, attempt]); // key stands for tab, q, category and radius

  const wider = RADII[RADII.indexOf(radius) + 1];

  return (
    <section className="stack">
      <h1>Search</h1>
      <input
        type="search"
        className="search-box"
        aria-label="Search"
        placeholder="Try diapers or feeding"
        value={typed}
        onChange={(e) => setTyped(e.target.value)}
      />
      <Tabs
        label="What to search"
        tabs={TABS}
        value={tab}
        onChange={(value) => update({ tab: value === "items" ? "" : value })}
      />
      <div role="radiogroup" aria-label="Category" className="chips">
        {CHIPS.map((c) => (
          <Chip key={c.label} selected={category === c.value} onSelect={() => update({ category: c.value })}>
            {c.label}
          </Chip>
        ))}
      </div>
      <label className="sort-line">
        Nearest first · within{" "}
        <select value={radius} onChange={(e) => update({ radius: e.target.value === "10" ? "" : e.target.value })}>
          {RADII.map((r) => (
            <option key={r} value={r}>
              {r} miles
            </option>
          ))}
        </select>
      </label>

      {user.account_type === "organization" ? (
        <NoteBox>Search near me is for families looking for items and resources.</NoteBox>
      ) : !profile?.zip ? (
        <>
          <NoteBox>Add your ZIP code to search near you. We never ask for your street address.</NoteBox>
          <Button to={ROUTES.profileSetup}>Set up your profile</Button>
        </>
      ) : housingItems ? (
        <div className="stack">
          <NoteBox>Housing help is listed under Resources.</NoteBox>
          <Button variant="outline" onClick={() => update({ tab: "resources" })}>
            See housing resources
          </Button>
        </div>
      ) : null}
      {profile?.zip && !housingItems && error && (
        <div className="stack" role="alert">
          <p className="form-error">Search couldn't load. {error}</p>
          <Button variant="outline" onClick={() => setAttempt((n) => n + 1)}>
            Try again
          </Button>
        </div>
      )}
      {profile?.zip && !housingItems && !error && !results && (
        <p className="search-loading" role="status">
          Searching near {profile.zip}…
        </p>
      )}
      {results?.length === 0 && (
        <div className="stack">
          <NoteBox>Nothing found within {radius} miles. Try a wider distance or fewer filters.</NoteBox>
          {wider && (
            <Button variant="outline" onClick={() => update({ radius: wider })}>
              Search within {wider} miles
            </Button>
          )}
        </div>
      )}
      {results?.length > 0 && (
        <ul className="result-list">
          {tab === "items"
            ? results.map((item) => <ItemCard key={item.id} item={item} />)
            : results.map((r) => <ResourceCard key={r.id} resource={r} />)}
        </ul>
      )}
    </section>
  );
}
