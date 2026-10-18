import { useState } from "react";
import Checkbox from "../../components/Checkbox.jsx";
import Chip from "../../components/Chip.jsx";
import ChoiceCard from "../../components/ChoiceCard.jsx";
import FieldError from "../../components/FieldError.jsx";
import NoteBox from "../../components/NoteBox.jsx";
import TextField from "../../components/TextField.jsx";

// Keys match the API (accounts.PersonProfileSerializer) and resources matching (KAN-16).
export const STAGES = [
  { value: "expecting", label: "Expecting" },
  { value: "parenting", label: "Parenting" },
  { value: "both", label: "Both" },
];
export const AGE_GROUPS = [
  { value: "under_3mo", label: "Under 3 mo" },
  { value: "3_12mo", label: "3-12 mo" },
  { value: "1_2yrs", label: "1-2 yrs" },
  { value: "3_5yrs", label: "3-5 yrs" },
];
export const ROLES = [
  { value: "parent", label: "Parent" },
  { value: "kinship", label: "Kinship caregiver" },
  { value: "foster", label: "Foster parent" },
  { value: "adoptive", label: "Adoptive parent" },
  { value: "guardian", label: "Legal guardian" },
  { value: "other", label: "Another role" },
  { value: "prefer_not", label: "Prefer not to say" },
];
export const NEEDS = [
  { value: "essentials", label: "Diapers & everyday essentials" },
  { value: "feeding", label: "Food & feeding support" },
  { value: "parenting", label: "Parenting & newborn support" },
  { value: "housing", label: "Housing & family stability" },
];
export const USAGES = [
  { value: "get", title: "Get support", description: "Find resources and items near me." },
  { value: "give", title: "Give support", description: "Share items with families nearby." },
  { value: "both", title: "Both", description: "Get and give. Many parents do both." },
];
const MAX_CHILDREN = 10;
export const STEPS = 4;

export const expects = (stage) => stage === "expecting" || stage === "both";
export const hasChildren = (stage) => stage === "parenting" || stage === "both";

// Prefer not to say clears the other roles; picking another role clears Prefer not to say.
function toggleRole(roles, role, on) {
  if (!on) return roles.filter((r) => r !== role);
  if (role === "prefer_not") return ["prefer_not"];
  return [...roles.filter((r) => r !== "prefer_not"), role];
}

// Returns {field: [message]} for whatever this step is missing.
export function missing(step, a) {
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

// The questions of one profile step (Mock Ups 3-6): the setup steps (KAN-6) and Edit on the Profile tab (KAN-24)
// show the same screens. `answers` is { zip, stage, arrival_month, ages[], roles[], needs[], usage }.
export default function ProfileQuestions({ step, answers, setAnswers, errors }) {
  const [showKinship, setShowKinship] = useState(false);
  const set = (field, value) => setAnswers((a) => ({ ...a, [field]: value }));
  const setAge = (i, value) => set("ages", answers.ages.map((age, j) => (j === i ? value : age)));
  const toggle = (field, value, on) =>
    set(field, on ? [...answers[field], value] : answers[field].filter((v) => v !== value));

  return (
    <>
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
      </>
    )}
    </>
  );
}
