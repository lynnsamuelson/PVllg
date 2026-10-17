import { useState } from "react";
import { Link, Navigate, useNavigate } from "react-router-dom";
import FieldError from "../../components/FieldError.jsx";
import { useAuth } from "../../context/AuthContext.jsx";
import { ROUTES } from "../../routes.js";

export default function SignupPage() {
  const { user, signup } = useAuth();
  const navigate = useNavigate();
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [error, setError] = useState("");
  const [fieldErrors, setFieldErrors] = useState({});
  const [submitting, setSubmitting] = useState(false);

  if (user) return <Navigate to={ROUTES.home} replace />;

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
      await signup(name, email, password);
      navigate(ROUTES.home, { replace: true });
    } catch (err) {
      setFieldErrors(err.fields || {});
      if (!err.fields || !Object.keys(err.fields).length) setError(err.message);
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <section className="auth-card">
      <h1>Create an account</h1>
      <form onSubmit={onSubmit} className="stack">
        {error && <p className="form-error">{error}</p>}
        <label>
          Name
          <input required autoComplete="name" value={name} onChange={(e) => setName(e.target.value)} />
          <FieldError messages={fieldErrors.name} />
        </label>
        <label>
          Email
          <input type="email" required autoComplete="email" value={email} onChange={(e) => setEmail(e.target.value)} />
          <FieldError messages={fieldErrors.email} />
        </label>
        <label>
          Password
          <input
            type="password"
            required
            autoComplete="new-password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
          />
          <small>At least 8 characters; not a common password; not too similar to your name or email.</small>
          <FieldError messages={fieldErrors.password} />
        </label>
        <label>
          Confirm password
          <input
            type="password"
            required
            autoComplete="new-password"
            value={confirm}
            onChange={(e) => setConfirm(e.target.value)}
          />
          <FieldError messages={fieldErrors.confirm} />
        </label>
        <button type="submit" disabled={submitting}>
          {submitting ? "Creating account…" : "Sign up"}
        </button>
      </form>
      <p>
        Already have an account? <Link to={ROUTES.login}>Log in</Link>
      </p>
    </section>
  );
}
