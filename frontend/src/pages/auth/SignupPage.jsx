import { useState } from "react";
import { Link, Navigate, useNavigate, useSearchParams } from "react-router-dom";
import Button from "../../components/Button.jsx";
import FieldError from "../../components/FieldError.jsx";
import TextField from "../../components/TextField.jsx";
import { useAuth } from "../../context/AuthContext.jsx";
import { homeFor, ROUTES } from "../../routes.js";

// Where each account type goes right after signing up.
const NEXT = { person: ROUTES.profileSetup, organization: ROUTES.orgSignup };

export default function SignupPage() {
  const { user, signup } = useAuth();
  const navigate = useNavigate();
  const accountType = useSearchParams()[0].get("type");
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [error, setError] = useState("");
  const [fieldErrors, setFieldErrors] = useState({});
  const [submitting, setSubmitting] = useState(false);

  // While submitting, onSubmit decides where a new account goes.
  if (user && !submitting) return <Navigate to={homeFor(user)} replace />;
  if (!Object.hasOwn(NEXT, accountType ?? "")) return <Navigate to={ROUTES.accountType} replace />;

  const onSubmit = async (e) => {
    e.preventDefault();
    setError("");
    setFieldErrors({});
    if (password !== confirm) {
      setFieldErrors({ confirm: ["Passwords don't match."] });
      return;
    }
    setSubmitting(true);
    try {
      await signup(name, email, password, accountType);
      navigate(NEXT[accountType], { replace: true });
    } catch (err) {
      setFieldErrors(err.fields || {});
      if (!err.fields || !Object.keys(err.fields).length) setError(err.message);
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <section>
      <Link to={ROUTES.accountType} className="back-link">
        ← Back
      </Link>
      <h1>Create your account</h1>
      <form onSubmit={onSubmit} className="stack">
        {error && <p className="form-error">{error}</p>}
        <TextField
          label="Name"
          required
          autoComplete="name"
          value={name}
          onChange={(e) => setName(e.target.value)}
          errors={fieldErrors.name}
        />
        <TextField
          label="Email"
          type="email"
          required
          autoComplete="email"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          errors={fieldErrors.email}
        />
        <TextField
          label="Password"
          type="password"
          required
          autoComplete="new-password"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          hint="At least 8 characters; not a common password; not too similar to your name or email."
          errors={fieldErrors.password}
        />
        <TextField
          label="Confirm password"
          type="password"
          required
          autoComplete="new-password"
          value={confirm}
          onChange={(e) => setConfirm(e.target.value)}
          errors={fieldErrors.confirm}
        />
        <FieldError messages={fieldErrors.account_type} />
        <Button type="submit" disabled={submitting}>
          {submitting ? "Creating account…" : "Sign up"}
        </Button>
      </form>
      <p className="hint">
        Already have an account? <Link to={ROUTES.login}>Sign in</Link>
      </p>
    </section>
  );
}
