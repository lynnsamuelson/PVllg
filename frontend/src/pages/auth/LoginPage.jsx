import { useState } from "react";
import { Link, Navigate, useLocation, useNavigate } from "react-router-dom";
import Button from "../../components/Button.jsx";
import TextField from "../../components/TextField.jsx";
import { useAuth } from "../../context/AuthContext.jsx";
import { homeFor, ROUTES } from "../../routes.js";

export default function LoginPage() {
  const { user, login } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [submitting, setSubmitting] = useState(false);

  // Return to the page they originally tried to open, or their first tab.
  const from = location.state?.from?.pathname;
  if (user) return <Navigate to={from || homeFor(user)} replace />;

  const onSubmit = async (e) => {
    e.preventDefault();
    setError("");
    setSubmitting(true);
    try {
      const signedIn = await login(email, password);
      navigate(from || homeFor(signedIn), { replace: true });
    } catch (err) {
      setError(err.message);
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <section>
      <Link to={ROUTES.welcome} className="back-link">
        ← Back
      </Link>
      <h1>Sign in</h1>
      <form onSubmit={onSubmit} className="stack">
        {error && <p className="form-error">{error}</p>}
        <TextField
          label="Email"
          type="email"
          required
          autoComplete="email"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
        />
        <TextField
          label="Password"
          type="password"
          required
          autoComplete="current-password"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
        />
        <Button type="submit" disabled={submitting}>
          {submitting ? "Signing in…" : "Sign in"}
        </Button>
      </form>
      <p className="hint">
        <Link to={ROUTES.forgotPassword}>Forgot your password?</Link>
      </p>
      <p className="hint">
        New here? <Link to={ROUTES.accountType}>Create an account</Link>
      </p>
    </section>
  );
}
