import { useEffect, useState } from "react";
import { useParams } from "react-router-dom";
import { getResource } from "../../api/client.js";
import BackToResults from "../../components/BackToResults.jsx";
import Badge from "../../components/Badge.jsx";
import BrandHeader from "../../components/BrandHeader.jsx";
import Button from "../../components/Button.jsx";
import { formatLongDate, resourceArea } from "../../format.js";
import { ROUTES } from "../../routes.js";

const NOT_LISTED = "Not listed";

// "nashville.gov" from "https://www.nashville.gov/departments/health/wic".
export function siteName(url) {
  try {
    return new URL(url).hostname.replace(/^www\./, "");
  } catch {
    return url;
  }
}

function Card({ title, children }) {
  return (
    <div className="card detail-card">
      <h2>{title}</h2>
      {children}
    </div>
  );
}

// Mock Up 22. Facts come from the program's official page (KAN-26); anything it doesn't list says "Not listed".
// The words never promise supplies, openings or acceptance: "may be a good fit", never "you qualify".
export default function ResourceDetailPage() {
  const { resourceId } = useParams();
  const [resource, setResource] = useState(null);
  const [error, setError] = useState(null);

  useEffect(() => {
    let current = true;
    setResource(null);
    setError(null);
    getResource(resourceId)
      .then((data) => current && setResource(data))
      .catch((err) => current && setError(err));
    return () => {
      current = false;
    };
  }, [resourceId]);

  const back = <BackToResults fallback={`${ROUTES.search}?tab=resources`} />;

  if (error) {
    return (
      <section className="stack">
        {back}
        <h1>{error.status === 404 ? "Resource not found" : "Couldn't load this resource"}</h1>
        {error.status !== 404 && (
          <p className="form-error" role="alert">
            {error.message}
          </p>
        )}
      </section>
    );
  }
  if (!resource) {
    return (
      <section className="stack">
        {back}
        <p role="status">Loading…</p>
      </section>
    );
  }

  const contact = [
    resource.public_phone && <a href={`tel:${resource.public_phone.replace(/[^\d+]/g, "")}`}>{resource.public_phone}</a>,
    resource.public_email && <a href={`mailto:${resource.public_email}`}>{resource.public_email}</a>,
    resource.public_address,
  ].filter(Boolean);
  return (
    <section>
      {back}
      <BrandHeader />
      <div className="stack">
        <h1 className="item-title">{resource.title}</h1>
        <p className="item-giver">
          {resource.category} · {resourceArea(resource)} <Badge variant="pending">Public listing</Badge>
        </p>
        <Card title="What it offers">
          <p>{resource.summary}</p>
          {resource.description && <p>{resource.description}</p>}
        </Card>
        <Card title="Who may be a good fit">
          <p>{resource.who_we_serve || NOT_LISTED}</p>
          {resource.age_text && <p>Ages: {resource.age_text}</p>}
          {resource.limits && <p>{resource.limits}</p>}
        </Card>
        <Card title="Next step">
          <p>{resource.next_step || NOT_LISTED}</p>
          <p>Referral or appointment: {resource.referral || NOT_LISTED}</p>
        </Card>
        <Card title="Contact">
          <p>
            Website:{" "}
            {resource.url ? (
              <a href={resource.url} target="_blank" rel="noreferrer">
                {siteName(resource.url)} ↗
              </a>
            ) : (
              NOT_LISTED
            )}
          </p>
          <p>
            Public contact:{" "}
            {contact.length
              ? contact.map((part, i) => (
                  <span key={i}>
                    {i > 0 && " · "}
                    {part}
                  </span>
                ))
              : NOT_LISTED}
          </p>
          {resource.contact_note && <p>{resource.contact_note}</p>}
        </Card>
        <p className="result-card-line">
          Source: {resource.source_url ? siteName(resource.source_url) : NOT_LISTED} · last checked{" "}
          {resource.last_checked ? formatLongDate(resource.last_checked) : NOT_LISTED}. Please confirm before you go.
        </p>
        {/* The Reach out preview is built in KAN-21; until then the button shows but does nothing. */}
        <Button>
          Reach out <Badge variant="demo">Demo</Badge>
        </Button>
      </div>
    </section>
  );
}
