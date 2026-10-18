import { useState } from "react";
import { Link, Navigate } from "react-router-dom";
import BrandHeader from "../../components/BrandHeader.jsx";
import Button from "../../components/Button.jsx";
import FieldError from "../../components/FieldError.jsx";
import NoteBox from "../../components/NoteBox.jsx";
import TextField from "../../components/TextField.jsx";
import { startOrgVerification } from "../../api/client.js";
import { useAuth } from "../../context/AuthContext.jsx";
import { homeFor, ROUTES } from "../../routes.js";

// Mock Up 7. Sends a code to a work email on the organization's own website domain.
export default function OrgSignupPage() {
  const { user, updateUser } = useAuth();
  const org = user.organization;
  const [name, setName] = useState(org?.name ?? user.name ?? "");
  const [website, setWebsite] = useState(org?.website ?? "");
  const [workEmail, setWorkEmail] = useState(org?.work_email ?? user.email ?? "");
  const [error, setError] = useState("");
  const [fieldErrors, setFieldErrors] = useState({});
  const [submitting, setSubmitting] = useState(false);
  const [next, setNext] = useState(null);

  if (next) return <Navigate to={next} replace />;
  if (user.account_type !== "organization") return <Navigate to={homeFor(user)} replace />;
  if (org?.status === "verified") return <Navigate to={ROUTES.orgItems} replace />;

  const onSubmit = async (e) => {
    e.preventDefault();
    setError("");
    setFieldErrors({});
    setSubmitting(true);
    try {
      updateUser(await startOrgVerification(name, website, workEmail));
      setNext(ROUTES.orgVerify);
    } catch (err) {
      setFieldErrors(err.fields || {});
      if (!err.fields || !Object.keys(err.fields).length) setError(err.message);
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <section>
      <BrandHeader />
      <h1>Tell us about your organization</h1>
      <form onSubmit={onSubmit} className="stack">
        {error && <p className="form-error">{error}</p>}
        <TextField
          label="Organization name"
          required
          autoComplete="organization"
          value={name}
          onChange={(e) => setName(e.target.value)}
          errors={fieldErrors.name}
        />
        <TextField
          label="Website"
          required
          autoComplete="url"
          placeholder="samplecommunitycloset.org"
          value={website}
          onChange={(e) => setWebsite(e.target.value)}
          errors={fieldErrors.website}
        />
        <TextField
          label="Work email"
          type="email"
          required
          autoComplete="email"
          placeholder="name@samplecommunitycloset.org"
          value={workEmail}
          onChange={(e) => setWorkEmail(e.target.value)}
          hint="Your email must end with your website's domain. Free email, like Gmail, can't be used to post items."
          errors={fieldErrors.work_email}
        />
        <FieldError messages={fieldErrors.non_field_errors} />
        <Button type="submit" disabled={submitting}>
          {submitting ? "Sending…" : "Send me a code"}
        </Button>
        <NoteBox>
          No domain email? You can still be listed as a resource. Posting items needs a confirmed domain email.
        </NoteBox>
      </form>
      <p className="hint">
        <Link to={ROUTES.orgItems}>Skip for now</Link>
      </p>
    </section>
  );
}
