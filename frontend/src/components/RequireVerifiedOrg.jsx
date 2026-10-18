import { Outlet } from "react-router-dom";
import { useAuth } from "../context/AuthContext.jsx";
import { ROUTES } from "../routes.js";
import Button from "./Button.jsx";
import NoteBox from "./NoteBox.jsx";

// Only a Verified organization can post items. Anyone else sees why instead of the page.
export default function RequireVerifiedOrg() {
  const { user } = useAuth();
  if (user.organization?.status === "verified") return <Outlet />;
  const isOrg = user.account_type === "organization";
  return (
    <section className="stack">
      <h1>Post an item</h1>
      <NoteBox>
        {isOrg
          ? "You can post items once your organization's email is confirmed. Posting items needs a confirmed domain email."
          : "Only verified organizations can post here."}
      </NoteBox>
      {isOrg && (
        <Button to={user.organization ? ROUTES.orgVerify : ROUTES.orgSignup}>Confirm your email</Button>
      )}
    </section>
  );
}
