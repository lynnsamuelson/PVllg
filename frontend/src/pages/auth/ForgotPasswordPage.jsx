import { useState } from "react";
import { Link } from "react-router-dom";
import Button from "../../components/Button.jsx";
import Placeholder from "../../components/Placeholder.jsx";
import TextField from "../../components/TextField.jsx";
import { ROUTES } from "../../routes.js";

export default function ForgotPasswordPage() {
  const [email, setEmail] = useState("");
  const [submitted, setSubmitted] = useState(false);

  const onSubmit = (e) => {
    e.preventDefault();
    setSubmitted(true);
  };

  return (
    <section className="auth-card">
      <h1>Reset your password</h1>
      <Placeholder>no email is sent yet.</Placeholder>
      {submitted ? (
        <p>If an account exists for {email}, a reset link would be sent.</p>
      ) : (
        <form onSubmit={onSubmit} className="stack">
          <TextField label="Email" type="email" required value={email} onChange={(e) => setEmail(e.target.value)} />
          <Button type="submit">Send reset link</Button>
        </form>
      )}
      <p>
        <Link to={ROUTES.login}>Back to log in</Link>
      </p>
    </section>
  );
}
