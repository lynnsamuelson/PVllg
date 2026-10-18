import { useState } from "react";
import { useNavigate } from "react-router-dom";
import * as api from "../../api/client.js";
import BrandHeader from "../../components/BrandHeader.jsx";
import Button from "../../components/Button.jsx";
import NoteBox from "../../components/NoteBox.jsx";
import Toggle from "../../components/Toggle.jsx";
import { useAuth } from "../../context/AuthContext.jsx";
import { ROUTES } from "../../routes.js";
import ProfileQuestions, { AGE_GROUPS, NEEDS, ROLES, STAGES, expects, missing } from "./ProfileQuestions.jsx";

const label = (list, value) => list.find((x) => x.value === value)?.label || value;
const listOf = (list, values) => (values.length ? values.map((v) => label(list, v)).join(", ") : "None");

// Profile rows (Mock Up 25) and the setup step each one's Edit opens.
const ROWS = [
  { title: "Area", step: 0, value: (a) => `ZIP ${a.zip}` },
  { title: "Family stage", step: 0, value: (a) => label(STAGES, a.stage) },
  { title: "Children's ages", step: 1, value: (a) => listOf(AGE_GROUPS, a.ages.filter(Boolean)) },
  { title: "Caregiving roles", step: 1, value: (a) => listOf(ROLES, a.roles) },
  { title: "Needs", step: 2, value: (a) => listOf(NEEDS, a.needs) },
];

const usageFor = (gets, gives) => (gets && gives ? "both" : gives ? "give" : "get");
// The step whose questions hold a field, to open it when that field has an error.
const STEP_OF = { zip: 0, stage: 0, arrival_month: 0, ages: 1, roles: 1, needs: 2 };
const firstStepWithError = (errors) =>
  Math.min(...Object.keys(errors).map((f) => (Object.hasOwn(STEP_OF, f) ? STEP_OF[f] : Infinity)));

function SignOut() {
  const { logout } = useAuth();
  const navigate = useNavigate();
  return (
    <Button
      variant="outline"
      onClick={async () => {
        await logout();
        navigate(ROUTES.welcome);
      }}
    >
      Sign out
    </Button>
  );
}

// Mock Up 25: a person's profile answers and the Get / Give switches. Edits stay on screen until Save changes.
function PersonProfile({ profile }) {
  const { updateUser } = useAuth();
  const [draft, setDraft] = useState({ ...profile, ages: profile.ages.length ? profile.ages : [null] });
  const [gets, setGets] = useState(profile.usage !== "give");
  const [gives, setGives] = useState(profile.usage !== "get");
  const [editing, setEditing] = useState(null); // a step number while its questions are open
  const [confirmGive, setConfirmGive] = useState(false);
  const [errors, setErrors] = useState({});
  const [switchError, setSwitchError] = useState("");
  const [message, setMessage] = useState("");
  const [saved, setSaved] = useState(false);
  const [saving, setSaving] = useState(false);
  const [dirty, setDirty] = useState(false);

  const changed = () => {
    setSaved(false);
    setMessage("");
    setDirty(true);
  };
  const setAnswers = (update) => {
    setDraft(update);
    changed();
  };

  const switchGet = (on) => {
    setSwitchError(on || gives ? "" : "Keep at least one on.");
    if (on || gives) {
      setGets(on);
      changed();
    }
  };
  const switchGive = (on) => {
    if (!on && !gets) {
      setSwitchError("Keep at least one on.");
      return;
    }
    setSwitchError("");
    if (on) setConfirmGive(true); // the short rules first, like Mock Up 6
    else {
      setGives(false);
      changed();
    }
  };

  const doneEditing = () => {
    const stepErrors = missing(editing, draft);
    setErrors(stepErrors);
    if (!Object.keys(stepErrors).length) setEditing(null);
  };

  const save = async () => {
    // A change on one step (e.g. Expecting to Parenting) can leave another incomplete: open the first one that is.
    for (const step of [0, 1, 2]) {
      const stepErrors = missing(step, draft);
      if (Object.keys(stepErrors).length) {
        setErrors(stepErrors);
        setEditing(step);
        return;
      }
    }
    setSaving(true);
    setMessage("");
    try {
      const user = await api.savePersonProfile({
        ...draft,
        arrival_month: expects(draft.stage) ? draft.arrival_month || "" : "",
        ages: draft.ages.filter(Boolean),
        usage: usageFor(gets, gives),
      });
      updateUser(user);
      setSaved(true);
      setDirty(false);
    } catch (err) {
      const fields = err.fields || {};
      setErrors(fields);
      setMessage(`Your changes weren't saved. ${err.message}`);
      const step = firstStepWithError(fields);
      if (Number.isFinite(step)) setEditing(step); // show the answer that was refused
    }
    setSaving(false);
  };

  if (editing !== null) {
    return (
      <div className="stack">
        <button type="button" className="back-link" onClick={doneEditing}>
          ← Back
        </button>
        <BrandHeader />
        <ProfileQuestions step={editing} answers={draft} setAnswers={setAnswers} errors={errors} />
        {message && (
          <p role="alert" className="form-error">
            {message}
          </p>
        )}
        <Button onClick={doneEditing}>Done</Button>
      </div>
    );
  }

  return (
    <div className="stack">
      <h1>Profile</h1>
      <BrandHeader />
      <Toggle label="Get support" checked={gets} onChange={switchGet} />
      <Toggle label="Give support" checked={gives} onChange={switchGive} />
      {confirmGive && (
        <div className="stack">
          <NoteBox>
            <strong>Before you give:</strong> post only items in good condition that aren&apos;t recalled. No car
            seats, breastmilk, medicine, or other health-sensitive items. Your exact location stays private until you
            approve a claim.
          </NoteBox>
          <div className="row">
            <Button
              small
              onClick={() => {
                setGives(true);
                setConfirmGive(false);
                changed();
              }}
            >
              Turn on Give support
            </Button>
            <Button small variant="outline" onClick={() => setConfirmGive(false)}>
              Not now
            </Button>
          </div>
        </div>
      )}
      {switchError && (
        <p className="form-error" role="alert">
          {switchError}
        </p>
      )}
      <p className="hint">Turn either on or off any time. Your claims and items are kept.</p>
      {/* Their tabs hide with the switch, so keep a way to what was already posted or claimed. */}
      {profile.usage === "give" && (
        <Button small variant="outline" to={ROUTES.claims}>
          My claims
        </Button>
      )}
      {profile.usage === "get" && (
        <Button small variant="outline" to={ROUTES.give}>
          My items
        </Button>
      )}
      <ul className="settings-list">
        {ROWS.map((row) => (
          <li key={row.title}>
            <span>
              {row.title}
              <small className="hint">{row.value(draft)}</small>
            </span>
            <button type="button" className="edit-link" onClick={() => setEditing(row.step)}>
              Edit<span className="sr-only"> {row.title}</span>
            </button>
          </li>
        ))}
      </ul>
      {saved && (
        <p role="status" className="saved">
          Saved
        </p>
      )}
      {dirty && <p className="hint">You have changes that aren&apos;t saved yet.</p>}
      {message && (
        <p role="alert" className="form-error">
          {message}
        </p>
      )}
      <Button onClick={save} disabled={saving}>
        Save changes
      </Button>
      <SignOut />
    </div>
  );
}

export default function ProfilePage() {
  const { user } = useAuth();

  if (user.account_type === "organization") {
    return (
      <section className="stack">
        <h1>Your profile</h1>
        <dl className="card details">
          <dt>Name</dt>
          <dd>{user.name}</dd>
          <dt>Email</dt>
          <dd>{user.email}</dd>
        </dl>
        {user.organization?.status === "verified" && <Button to={ROUTES.orgProfile}>Organization profile</Button>}
        <SignOut />
      </section>
    );
  }

  return (
    <section>
      {user.profile ? (
        <PersonProfile profile={user.profile} />
      ) : (
        <div className="stack">
          <h1>Profile</h1>
          <BrandHeader />
          <NoteBox>Set up your profile so we can show you things near you.</NoteBox>
          <Button to={ROUTES.profileSetup}>Set up your profile</Button>
          <SignOut />
        </div>
      )}
    </section>
  );
}
