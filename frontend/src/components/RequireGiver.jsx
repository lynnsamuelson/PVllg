import { Outlet } from "react-router-dom";
import { useAuth } from "../context/AuthContext.jsx";
import NoteBox from "./NoteBox.jsx";
import RequireVerifiedOrg from "./RequireVerifiedOrg.jsx";

// Screens for givers: a Verified organization, or a person with Give support (or Both) on. Anyone else sees why.
export default function RequireGiver({ title }) {
  const { user } = useAuth();
  if (user.account_type === "organization") {
    return (
      <RequireVerifiedOrg
        title={title}
        pendingNote="You can post items once your organization's email is confirmed. Posting items needs a confirmed domain email."
      />
    );
  }
  if (user.gives) return <Outlet />;
  return (
    <section className="stack">
      <h1>{title}</h1>
      <NoteBox>Posting items is for people with Give support on.</NoteBox>
    </section>
  );
}
