import { Navigate, useLocation } from "react-router-dom";
import Button from "../../components/Button.jsx";
import Logo from "../../components/Logo.jsx";
import NoteBox from "../../components/NoteBox.jsx";
import { useAuth } from "../../context/AuthContext.jsx";
import { homeFor, ROUTES } from "../../routes.js";

// Mock Up 1.
export default function WelcomePage() {
  const { user } = useAuth();
  const location = useLocation();
  if (user) return <Navigate to={homeFor(user)} replace />;

  return (
    <section className="welcome">
      <Logo />
      <h1 className="welcome-name">PVill</h1>
      <p className="welcome-motto">Many journeys. One village.</p>
      <p>Find local support and essentials for your family, or share what you can.</p>
      <div className="stack">
        <Button to={ROUTES.accountType}>Get started</Button>
        {/* Carry the page they were headed to through to sign in. */}
        <Button variant="outline" to={ROUTES.login} state={location.state}>
          Sign in
        </Button>
        <NoteBox>This demo uses made-up people and organizations.</NoteBox>
      </div>
    </section>
  );
}
