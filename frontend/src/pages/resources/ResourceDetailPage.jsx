import { Link, useParams } from "react-router-dom";
import Placeholder from "../../components/Placeholder.jsx";
import { getMockResource } from "../../data/mockResources.js";
import { ROUTES } from "../../routes.js";

export default function ResourceDetailPage() {
  const { resourceId } = useParams();
  const resource = getMockResource(resourceId);

  if (!resource) {
    return (
      <section>
        <h1>Resource not found</h1>
        <Link to={ROUTES.home}>← Back to resources</Link>
      </section>
    );
  }

  return (
    <section>
      <Link to={ROUTES.home}>← Back to resources</Link>
      <h1>{resource.title}</h1>
      <Placeholder>detail layout awaiting design.</Placeholder>
      <span className="tag">{resource.category}</span>
      <p>{resource.description}</p>
    </section>
  );
}
