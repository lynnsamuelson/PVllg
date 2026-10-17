import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { listResources } from "../../api/client.js";
import Placeholder from "../../components/Placeholder.jsx";
import { useAuth } from "../../context/AuthContext.jsx";
import { ROUTES } from "../../routes.js";

export default function HomePage() {
  const { user } = useAuth();
  const [resources, setResources] = useState(null);
  const [error, setError] = useState("");

  useEffect(() => {
    listResources()
      .then(setResources)
      .catch((e) => setError(e.message));
  }, []);

  return (
    <section>
      <h1>Welcome, {user.name}</h1>
      <Placeholder>layout awaiting design; resources are sample data (edit them in /admin/).</Placeholder>

      <h2>Resources</h2>
      {error && <p className="form-error">{error}</p>}
      {!resources && !error && <p>Loading…</p>}
      {resources?.length === 0 && <p>No resources yet.</p>}
      {resources?.length > 0 && (
        <ul className="resource-list">
          {resources.map((r) => (
            <li key={r.id} className="card">
              <span className="tag">{r.category}</span>
              <h3>
                <Link to={ROUTES.resource(r.id)}>{r.title}</Link>
              </h3>
              <p>{r.summary}</p>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}
