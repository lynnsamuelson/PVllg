import { NavLink } from "react-router-dom";
import { ROUTES } from "../routes.js";

const PERSON_TABS = [
  { to: ROUTES.home, label: "Home" },
  { to: ROUTES.search, label: "Search", getters: true },
  { to: ROUTES.claims, label: "Claims", getters: true },
  { to: ROUTES.give, label: "Give", givers: true },
  { to: ROUTES.profile, label: "Profile" },
];

const ORG_TABS = [
  { to: ROUTES.orgItems, label: "Items" },
  { to: ROUTES.claims, label: "Claims" },
  { to: ROUTES.impact, label: "Impact" },
  { to: ROUTES.profile, label: "Profile" },
];

// Bottom bar on every signed-in screen, matching the Profile switches (KAN-24): Give shows only with Give support on,
// Search and Claims only with Get support on.
export default function BottomNav({ user }) {
  const tabs =
    user.account_type === "organization"
      ? ORG_TABS
      : PERSON_TABS.filter((t) => (!t.givers || user.gives) && (!t.getters || user.gets !== false));
  return (
    <nav className="bottom-nav" aria-label="Main">
      {tabs.map((t) => (
        <NavLink key={t.label} to={t.to} end>
          {t.label}
        </NavLink>
      ))}
    </nav>
  );
}
