// Pill badge, always plum text. Variants follow AGENTS.md: verified, pending.
export default function Badge({ variant, children }) {
  return <span className={`badge badge-${variant}`}>{children}</span>;
}
