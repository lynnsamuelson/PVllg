import { Link } from "react-router-dom";
import { ROUTES } from "../routes.js";

export default function NotFoundPage() {
  return (
    <section>
      <h1>Page not found</h1>
      <Link to={ROUTES.home}>Go to the home page</Link>
    </section>
  );
}
