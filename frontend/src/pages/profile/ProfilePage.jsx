import { Link } from "react-router-dom";
import Placeholder from "../../components/Placeholder.jsx";
import { useAuth } from "../../context/AuthContext.jsx";
import { ROUTES } from "../../routes.js";

export default function ProfilePage() {
  const { user } = useAuth();

  return (
    <section>
      <h1>Your profile</h1>
      <Placeholder>profile fields and editing awaiting design.</Placeholder>
      <dl className="card details">
        <dt>Name</dt>
        <dd>{user.name}</dd>
        <dt>Email</dt>
        <dd>{user.email}</dd>
        <dt>Member since</dt>
        <dd>{user.joined}</dd>
      </dl>
      <p>
        <Link to={ROUTES.home}>← Back to resources</Link>
      </p>
    </section>
  );
}
