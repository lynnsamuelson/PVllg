import { useState } from "react";
import { Link, useLocation, useNavigate } from "react-router-dom";
import Placeholder from "../../components/Placeholder.jsx";
import { useAuth } from "../../context/AuthContext.jsx";
import { ROUTES } from "../../routes.js";

export default function LoginPage() {
  const { login } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");

  const onSubmit = async (e) => {
    e.preventDefault();
    await login(email, password);
    // Return to the page they originally tried to open, or home.
    navigate(location.state?.from?.pathname || ROUTES.home, { replace: true });
  };

  return (
    <section className="auth-card">
      <h1>Log in</h1>
      <Placeholder>any email and password will log you in.</Placeholder>
      <form onSubmit={onSubmit} className="stack">
        <label>
          Email
          <input type="email" required value={email} onChange={(e) => setEmail(e.target.value)} />
        </label>
        <label>
          Password
          <input type="password" required value={password} onChange={(e) => setPassword(e.target.value)} />
        </label>
        <button type="submit">Log in</button>
      </form>
      <p>
        <Link to={ROUTES.forgotPassword}>Forgot your password?</Link>
      </p>
      <p>
        New here? <Link to={ROUTES.signup}>Create an account</Link>
      </p>
    </section>
  );
}
