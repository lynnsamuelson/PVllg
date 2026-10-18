import { Outlet } from "react-router-dom";
import { useAuth } from "../context/AuthContext.jsx";
import NoteBox from "./NoteBox.jsx";
import RequireVerifiedOrg from "./RequireVerifiedOrg.jsx";

// Screens for givers: a Verified organization, or a person with Give support (or Both) on. Anyone else sees why.
// `anyPerson` lets every person through (My items: someone who turns Give off can still manage what they posted).
export default function RequireGiver({ title, anyPerson = false }) {
  const { user } = useAuth();
  if (user.account_type === "organization") {
    return (
      <RequireVerifiedOrg
        title={title}
        pendingNote="You can post items once your organization's email is confirmed. Posting items needs a confirmed domain email."
      />
    );
  }
  if (user.gives || anyPerson) return <Outlet />;
  return (
    <section className="stack">
      <h1>{title}</h1>
      <NoteBox>Posting items is for people with Give support on.</NoteBox>
    </section>
  );
}
