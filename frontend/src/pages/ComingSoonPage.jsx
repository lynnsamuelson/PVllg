import Placeholder from "../components/Placeholder.jsx";

// Stands in for a screen whose own ticket isn't built yet, so no tab or hand-off opens a broken page.
export default function ComingSoonPage({ title }) {
  return (
    <section>
      <h1>{title}</h1>
      <Placeholder>coming soon.</Placeholder>
    </section>
  );
}
