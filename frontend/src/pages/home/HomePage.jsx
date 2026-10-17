import { Link } from "react-router-dom";
import Placeholder from "../../components/Placeholder.jsx";
import { useAuth } from "../../context/AuthContext.jsx";
import { mockResources } from "../../data/mockResources.js";
import { ROUTES } from "../../routes.js";

export default function HomePage() {
  const { user } = useAuth();

  return (
    <section>
      <h1>Welcome, {user.name}</h1>
      <Placeholder>layout awaiting design; resources are sample data.</Placeholder>

      <h2>Resources</h2>
      <ul className="resource-list">
        {mockResources.map((r) => (
          <li key={r.id} className="card">
            <span className="tag">{r.category}</span>
            <h3>
              <Link to={ROUTES.resource(r.id)}>{r.title}</Link>
            </h3>
            <p>{r.summary}</p>
          </li>
        ))}
      </ul>
    </section>
  );
}
