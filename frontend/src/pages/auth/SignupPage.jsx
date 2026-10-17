import { useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import Placeholder from "../../components/Placeholder.jsx";
import { useAuth } from "../../context/AuthContext.jsx";
import { ROUTES } from "../../routes.js";

export default function SignupPage() {
  const { signup } = useAuth();
  const navigate = useNavigate();
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");

  const onSubmit = async (e) => {
    e.preventDefault();
    await signup(name, email, password);
    navigate(ROUTES.home, { replace: true });
  };

  return (
    <section className="auth-card">
      <h1>Create an account</h1>
      <Placeholder>no account is actually created yet.</Placeholder>
      <form onSubmit={onSubmit} className="stack">
        <label>
          Name
          <input required value={name} onChange={(e) => setName(e.target.value)} />
        </label>
        <label>
          Email
          <input type="email" required value={email} onChange={(e) => setEmail(e.target.value)} />
        </label>
        <label>
          Password
          <input type="password" required value={password} onChange={(e) => setPassword(e.target.value)} />
        </label>
        <button type="submit">Sign up</button>
      </form>
      <p>
        Already have an account? <Link to={ROUTES.login}>Log in</Link>
      </p>
    </section>
  );
}
