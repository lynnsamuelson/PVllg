import Placeholder from "../components/Placeholder.jsx";

// Stands in for a screen whose own ticket isn't built yet, so no tab or hand-off opens a broken page.
// `children` (e.g. a button to a screen that is built) show under the banner.
export default function ComingSoonPage({ title, children }) {
  return (
    <section className="stack">
      <h1>{title}</h1>
      <Placeholder>coming soon.</Placeholder>
      {children}
    </section>
  );
}
