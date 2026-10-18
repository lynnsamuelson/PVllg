import { useState } from "react";
import { Navigate } from "react-router-dom";
import * as api from "../../api/client.js";
import BrandHeader from "../../components/BrandHeader.jsx";
import Button from "../../components/Button.jsx";
import ProgressBar from "../../components/ProgressBar.jsx";
import { useAuth } from "../../context/AuthContext.jsx";
import { ROUTES } from "../../routes.js";
import ProfileQuestions, { STEPS, expects, missing } from "./ProfileQuestions.jsx";

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
  const [next, setNext] = useState(null);

  if (next) return <Navigate to={next} replace />;

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

        <ProfileQuestions step={step} answers={answers} setAnswers={setAnswers} errors={errors} />
        {step === STEPS - 1 && saveError && <p className="form-error">{saveError}</p>}

        <Button type="submit" disabled={saving}>
          {step < STEPS - 1 ? "Next" : saving ? "Saving…" : "Finish my profile"}
        </Button>
      </form>
    </section>
  );
}
