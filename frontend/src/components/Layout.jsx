import { Outlet } from "react-router-dom";
import { useAuth } from "../context/AuthContext.jsx";
import BottomNav from "./BottomNav.jsx";

// Shared frame for every page: the current page, plus the bottom bar once signed in.
export default function Layout() {
  const { user } = useAuth();
  return (
    <>
      <main className={`page${user ? " with-nav" : ""}`}>
        <Outlet />
      </main>
      {user && <BottomNav user={user} />}
    </>
  );
}
