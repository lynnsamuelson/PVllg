import { useState } from "react";
import { Navigate } from "react-router-dom";
import * as api from "../../api/client.js";
import BrandHeader from "../../components/BrandHeader.jsx";
import Button from "../../components/Button.jsx";
import Checkbox from "../../components/Checkbox.jsx";
import Chip from "../../components/Chip.jsx";
import ChoiceCard from "../../components/ChoiceCard.jsx";
import FieldError from "../../components/FieldError.jsx";
import NoteBox from "../../components/NoteBox.jsx";
import ProgressBar from "../../components/ProgressBar.jsx";
import TextField from "../../components/TextField.jsx";
import { useAuth } from "../../context/AuthContext.jsx";
import { ROUTES } from "../../routes.js";

// Keys match the API (accounts.PersonProfileSerializer) and resources matching (KAN-16).
const STAGES = [
  { value: "expecting", label: "Expecting" },
  { value: "parenting", label: "Parenting" },
  { value: "both", label: "Both" },
];
const AGE_GROUPS = [
  { value: "under_3mo", label: "Under 3 mo" },
  { value: "3_12mo", label: "3-12 mo" },
  { value: "1_2yrs", label: "1-2 yrs" },
  { value: "3_5yrs", label: "3-5 yrs" },
];
const ROLES = [
  { value: "parent", label: "Parent" },
  { value: "kinship", label: "Kinship caregiver" },
  { value: "foster", label: "Foster parent" },
  { value: "adoptive", label: "Adoptive parent" },
  { value: "guardian", label: "Legal guardian" },
  { value: "other", label: "Another role" },
  { value: "prefer_not", label: "Prefer not to say" },
];
const NEEDS = [
  { value: "essentials", label: "Diapers & everyday essentials" },
  { value: "feeding", label: "Food & feeding support" },
  { value: "parenting", label: "Parenting & newborn support" },
  { value: "housing", label: "Housing & family stability" },
];
const USAGES = [
  { value: "get", title: "Get support", description: "Find resources and items near me." },
  { value: "give", title: "Give support", description: "Share items with families nearby." },
  { value: "both", title: "Both", description: "Get and give. Many parents do both." },
];
const MAX_CHILDREN = 10;
const STEPS = 4;

const expects = (stage) => stage === "expecting" || stage === "both";
const hasChildren = (stage) => stage === "parenting" || stage === "both";

// Prefer not to say clears the other roles; picking another role clears Prefer not to say.
function toggleRole(roles, role, on) {
  if (!on) return roles.filter((r) => r !== role);
  if (role === "prefer_not") return ["prefer_not"];
  return [...roles.filter((r) => r !== "prefer_not"), role];
}

// Returns {field: [message]} for whatever this step is missing.
function missing(step, a) {
  const errors = {};
  if (step === 0) {
    if (!/^\d{5}$/.test(a.zip)) errors.zip = ["Enter your 5-digit ZIP code."];
    if (!a.stage) errors.stage = ["Pick Expecting, Parenting, or Both."];
  } else if (step === 1) {
    if (hasChildren(a.stage) && a.ages.some((age) => !age)) errors.ages = ["Pick an age group for each child."];
  } else if (step === 2) {
    if (!a.needs.length) errors.needs = ["Pick at least one."];
  } else if (step === 3) {
    if (!a.usage) errors.usage = ["Pick how you want to use PVill."];
  }
  return errors;
}

// Mock Ups 3-6. A person's four profile steps right after sign-up.
export default function ProfileSetupPage() {
  const { updateUser } = useAuth();
  const [step, setStep] = useState(0);
  const [answers, setAnswers] = useState({
    zip: "",
    stage: "",
    arrival_month: "",
    ages: [null],
    roles: [],
    needs: [],
    usage: "",
  });
  const [errors, setErrors] = useState({});
  const [saveError, setSaveError] = useState("");
  const [saving, setSaving] = useState(false);
  const [showKinship, setShowKinship] = useState(false);
  const [next, setNext] = useState(null);

  if (next) return <Navigate to={next} replace />;

  const set = (field, value) => setAnswers((a) => ({ ...a, [field]: value }));
  const setAge = (i, value) => set("ages", answers.ages.map((age, j) => (j === i ? value : age)));
  const toggle = (field, value, on) =>
    set(field, on ? [...answers[field], value] : answers[field].filter((v) => v !== value));

  const back = () => {
    setErrors({});
    setStep(step - 1);
  };

  const onNext = async (e) => {
    e.preventDefault();
    const stepErrors = missing(step, answers);
    setErrors(stepErrors);
    if (Object.keys(stepErrors).length) return;
    if (step < STEPS - 1) {
      setStep(step + 1);
      return;
    }
    setSaveError("");
    setSaving(true);
    try {
      const user = await api.savePersonProfile({
        ...answers,
        arrival_month: expects(answers.stage) ? answers.arrival_month : "",
        ages: answers.ages.filter(Boolean),
      });
      updateUser(user);
      setNext(ROUTES.home);
    } catch (err) {
      setSaveError(`Your answers weren't saved. ${err.message}`);
      setSaving(false);
    }
  };

  return (
    <section>
      {step > 0 && (
        <button type="button" className="back-link" onClick={back}>
          ← Back
        </button>
      )}
      <BrandHeader />
      <form onSubmit={onNext} className="stack" noValidate>
        <ProgressBar step={step + 1} total={STEPS} />

        {step === 0 && (
          <>
            <h1>Where are you in your journey?</h1>
            <TextField
              label="ZIP code (required)"
              inputMode="numeric"
              autoComplete="postal-code"
              maxLength={5}
              placeholder="Enter ZIP code"
              value={answers.zip}
              onChange={(e) => set("zip", e.target.value.replace(/\D/g, ""))}
              hint="We use this to find things near you. We never ask for your street address."
              errors={errors.zip}
            />
            <p className="field-label" id="stage-label">
              I am...
            </p>
            <div role="radiogroup" aria-labelledby="stage-label" className="chips">
              {STAGES.map((s) => (
                <Chip key={s.value} selected={answers.stage === s.value} onSelect={() => set("stage", s.value)}>
                  {s.label}
                </Chip>
              ))}
            </div>
            <FieldError messages={errors.stage} />
            {expects(answers.stage) && (
              <TextField
                label="Expected arrival month"
                type="month"
                value={answers.arrival_month}
                onChange={(e) => set("arrival_month", e.target.value)}
              />
            )}
          </>
        )}

        {step === 1 && (
          <>
            <h1>Your children and your role</h1>
            {answers.ages.map((age, i) => (
              <div key={i} className="stack">
                <p className="field-label" id={`age-label-${i}`}>
                  {answers.ages.length > 1 ? `Child ${i + 1}'s age group` : "Child's age group"}
                </p>
                <div role="radiogroup" aria-labelledby={`age-label-${i}`} className="chips">
                  {AGE_GROUPS.map((g) => (
                    <Chip key={g.value} selected={age === g.value} onSelect={() => setAge(i, g.value)}>
                      {g.label}
                    </Chip>
                  ))}
                </div>
                {i > 0 && (
                  <button
                    type="button"
                    className="text-link"
                    onClick={() => set("ages", answers.ages.filter((_, j) => j !== i))}
                  >
                    Remove child {i + 1}
                  </button>
                )}
              </div>
            ))}
            <FieldError messages={errors.ages} />
            {answers.ages.length < MAX_CHILDREN && (
              <button type="button" className="text-link" onClick={() => set("ages", [...answers.ages, null])}>
                + Add another child
              </button>
            )}
            <fieldset className="checkbox-list">
              <legend className="field-label">Your role (pick any)</legend>
              {ROLES.map((r) => (
                <Checkbox
                  key={r.value}
                  label={r.label}
                  checked={answers.roles.includes(r.value)}
                  onChange={(on) => set("roles", toggleRole(answers.roles, r.value, on))}
                >
                  {r.value === "kinship" && (
                    <button
                      type="button"
                      className="info-button"
                      aria-label="What is a kinship caregiver?"
                      aria-expanded={showKinship}
                      onClick={() => setShowKinship(!showKinship)}
                    >
                      ⓘ
                    </button>
                  )}
                </Checkbox>
              ))}
              {showKinship && (
                <p className="hint">You care for a relative&apos;s or close family friend&apos;s child.</p>
              )}
            </fieldset>
          </>
        )}

        {step === 2 && (
          <>
            <h1>What would help right now?</h1>
            <fieldset className="checkbox-list">
              <legend className="hint">Pick any that fit.</legend>
              {NEEDS.map((n) => (
                <Checkbox
                  key={n.value}
                  label={n.label}
                  checked={answers.needs.includes(n.value)}
                  onChange={(on) => toggle("needs", n.value, on)}
                />
              ))}
            </fieldset>
            <FieldError messages={errors.needs} />
            <NoteBox>Pick at least one so we can show you useful results.</NoteBox>
          </>
        )}

        {step === 3 && (
          <>
            <h1>How do you want to use PVill?</h1>
            <p className="hint">Choose one. You can switch anytime.</p>
            <div role="radiogroup" aria-label="How you want to use PVill" className="stack card-list">
              {USAGES.map((u) => (
                <ChoiceCard key={u.value} {...u} selected={answers.usage === u.value} onSelect={() => set("usage", u.value)} />
              ))}
            </div>
            <FieldError messages={errors.usage} />
            <NoteBox>If you give, your exact location stays private until you approve a claim.</NoteBox>
            {saveError && <p className="form-error">{saveError}</p>}
          </>
        )}

        <Button type="submit" disabled={saving}>
          {step < STEPS - 1 ? "Next" : saving ? "Saving…" : "Finish my profile"}
        </Button>
      </form>
    </section>
  );
}
