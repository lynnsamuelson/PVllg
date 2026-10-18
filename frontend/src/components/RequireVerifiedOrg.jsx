import { Outlet } from "react-router-dom";
import { useAuth } from "../context/AuthContext.jsx";
import { ROUTES } from "../routes.js";
import Button from "./Button.jsx";
import NoteBox from "./NoteBox.jsx";

// Screens only a Verified organization can use. Anyone else sees why instead of the page.
export default function RequireVerifiedOrg({
  title = "Post an item",
  pendingNote = "You can post items once your organization's email is confirmed. Posting items needs a confirmed domain email.",
  othersNote = "Only verified organizations can post here.",
}) {
  const { user } = useAuth();
  if (user.organization?.status === "verified") return <Outlet />;
  const isOrg = user.account_type === "organization";
  return (
    <section className="stack">
      <h1>{title}</h1>
      <NoteBox>{isOrg ? pendingNote : othersNote}</NoteBox>
      {isOrg && (
        <Button to={user.organization ? ROUTES.orgVerify : ROUTES.orgSignup}>Confirm your email</Button>
      )}
    </section>
  );
}
