import { Link, NavLink, useNavigate } from "react-router-dom";
import { useAuth } from "../context/AuthContext.jsx";
import { ROUTES } from "../routes.js";

export default function NavBar() {
  const { user, logout } = useAuth();
  const navigate = useNavigate();

  const onLogout = async () => {
    await logout();
    navigate(ROUTES.login);
  };

  return (
    <header className="navbar">
      <Link to={ROUTES.home} className="brand">
        PVllg
      </Link>
      <nav>
        {user ? (
          <>
            <NavLink to={ROUTES.home} end>
              Resources
            </NavLink>
            <NavLink to={ROUTES.profile}>Profile</NavLink>
            <button type="button" className="link-button" onClick={onLogout}>
              Log out
            </button>
          </>
        ) : (
          <>
            <NavLink to={ROUTES.login}>Log in</NavLink>
            <NavLink to={ROUTES.signup}>Sign up</NavLink>
          </>
        )}
      </nav>
    </header>
  );
}
