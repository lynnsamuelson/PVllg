import { useState } from "react";
import { Link, Navigate } from "react-router-dom";
import Badge from "../../components/Badge.jsx";
import BrandHeader from "../../components/BrandHeader.jsx";
import Button from "../../components/Button.jsx";
import CodeInput from "../../components/CodeInput.jsx";
import FieldError from "../../components/FieldError.jsx";
import NoteBox from "../../components/NoteBox.jsx";
import { resendOrgCode, verifyOrgCode } from "../../api/client.js";
import { useAuth } from "../../context/AuthContext.jsx";
import { ROUTES } from "../../routes.js";

// Mock Up 8. Pending until the emailed code is right, then Verified.
export default function OrgVerifyPage() {
  const { user, updateUser } = useAuth();
  const org = user.organization;
  const [code, setCode] = useState("");
  const [errors, setErrors] = useState([]);
  const [sent, setSent] = useState("");
  const [busy, setBusy] = useState(false);

  if (!org) return <Navigate to={ROUTES.orgSignup} replace />;
  const verified = org.status === "verified";

  const run = async (call) => {
    setErrors([]);
    setSent("");
    setBusy(true);
    try {
      updateUser(await call());
      return true;
    } catch (err) {
      setErrors(err.fields?.code ?? [err.message]);
      return false;
    } finally {
      setBusy(false);
    }
  };

  const onConfirm = (e) => {
    e.preventDefault();
    run(() => verifyOrgCode(code));
  };

  const onResend = async () => {
    if (await run(resendOrgCode)) {
      setCode("");
      setSent("We sent a new code. The old one no longer works.");
    }
  };

  return (
    <section>
      <Link to={ROUTES.orgSignup} className="back-link">
        ← Back
      </Link>
      <BrandHeader />
      <h1>{verified ? "Email confirmed" : "Check your email"}</h1>
      {verified ? (
        <div className="stack">
          <StatusCard verified />
          <Button to={ROUTES.orgProfile}>Continue</Button>
        </div>
      ) : (
        <form onSubmit={onConfirm} className="stack">
          <p>We sent a 6-digit code to {org.work_email}.</p>
          <CodeInput value={code} onChange={setCode} invalid={errors.length > 0} disabled={busy} />
          <FieldError messages={errors} />
          {sent && <p role="status">{sent}</p>}
          <Button type="submit" disabled={busy || code.length < 6}>
            Confirm
          </Button>
          <Button variant="outline" onClick={onResend} disabled={busy}>
            Send a new code
          </Button>
          <StatusCard />
          <NoteBox>Wrong or old code? We&apos;ll say so and let you try again.</NoteBox>
        </form>
      )}
    </section>
  );
}

function StatusCard({ verified = false }) {
  return (
    <div className="card status-card">
      <p className="status-card-title">
        Status {verified ? <Badge variant="verified">Verified</Badge> : <Badge variant="pending">Pending</Badge>}
      </p>
      <p className="hint">
        {verified ? (
          "You can post items."
        ) : (
          <>
            After you confirm, this changes to <Badge variant="verified">Verified</Badge> and you can post items.
          </>
        )}
      </p>
    </div>
  );
}
