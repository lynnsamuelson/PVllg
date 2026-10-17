import { useEffect, useState } from "react";
import { Link, useParams } from "react-router-dom";
import { getResource } from "../../api/client.js";
import Placeholder from "../../components/Placeholder.jsx";
import { ROUTES } from "../../routes.js";

export default function ResourceDetailPage() {
  const { resourceId } = useParams();
  const [resource, setResource] = useState(null);
  const [error, setError] = useState(null);

  useEffect(() => {
    setResource(null);
    setError(null);
    getResource(resourceId).then(setResource).catch(setError);
  }, [resourceId]);

  const back = <Link to={ROUTES.home}>← Back to resources</Link>;

  if (error) {
    return (
      <section>
        {back}
        <h1>{error.status === 404 ? "Resource not found" : "Couldn't load this resource"}</h1>
        {error.status !== 404 && <p className="form-error">{error.message}</p>}
      </section>
    );
  }
  if (!resource) return <p>Loading…</p>;

  return (
    <section>
      {back}
      <h1>{resource.title}</h1>
      <Placeholder>detail layout awaiting design.</Placeholder>
      <span className="tag">{resource.category}</span>
      <p>{resource.description}</p>
      {resource.url && (
        <p>
          <a href={resource.url} target="_blank" rel="noreferrer">
            Visit resource ↗
          </a>
        </p>
      )}
    </section>
  );
}
