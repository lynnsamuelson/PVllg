import { Outlet } from "react-router-dom";
import NavBar from "./NavBar.jsx";

// Shared frame for every page: nav bar on top, the current page below.
export default function Layout() {
  return (
    <>
      <NavBar />
      <main className="page">
        <Outlet />
      </main>
    </>
  );
}
