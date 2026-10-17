import { useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import Button from "../../components/Button.jsx";
import ChoiceCard from "../../components/ChoiceCard.jsx";
import NoteBox from "../../components/NoteBox.jsx";
import { ROUTES } from "../../routes.js";

const TYPES = [
  {
    value: "person",
    title: "A person",
    description: "I'm a parent or caregiver. I can get support, give support, or both.",
  },
  {
    value: "organization",
    title: "An organization",
    description: "A nonprofit, agency, or group that shares items and resources.",
  },
];

// Mock Up 2.
export default function AccountTypePage() {
  const navigate = useNavigate();
  const [type, setType] = useState(null);

  return (
    <section>
      <Link to={ROUTES.welcome} className="back-link">
        ← Back
      </Link>
      <h1>Who is signing up?</h1>
      <p className="hint">You can change how you use PVill later.</p>
      <div className="stack">
        <div role="radiogroup" aria-label="Account type" className="stack card-list">
          {TYPES.map((t) => (
            <ChoiceCard key={t.value} {...t} selected={type === t.value} onSelect={() => setType(t.value)} />
          ))}
        </div>
        <NoteBox>Organizations confirm their email before they can post.</NoteBox>
        <Button disabled={!type} onClick={() => navigate(`${ROUTES.signup}?type=${type}`)}>
          Continue
        </Button>
      </div>
    </section>
  );
}
