import { useNavigate } from "react-router-dom";
import Button from "../../components/Button.jsx";
import Placeholder from "../../components/Placeholder.jsx";
import { useAuth } from "../../context/AuthContext.jsx";
import { ROUTES } from "../../routes.js";

export default function ProfilePage() {
  const { user, logout } = useAuth();
  const navigate = useNavigate();

  const onLogout = async () => {
    await logout();
    navigate(ROUTES.welcome);
  };

  return (
    <section>
      <h1>Your profile</h1>
      <Placeholder>profile editing awaiting design.</Placeholder>
      <dl className="card details">
        <dt>Name</dt>
        <dd>{user.name}</dd>
        <dt>Email</dt>
        <dd>{user.email}</dd>
        <dt>Member since</dt>
        <dd>{new Date(user.joined).toLocaleDateString()}</dd>
      </dl>
      <Button variant="outline" onClick={onLogout}>
        Sign out
      </Button>
    </section>
  );
}
