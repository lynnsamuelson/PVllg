import { Navigate, Outlet, useLocation } from "react-router-dom";
import { useAuth } from "../context/AuthContext.jsx";
import { ROUTES } from "../routes.js";

// Sends logged-out visitors to the login page, remembering where they were headed.
export default function ProtectedRoute() {
  const { user } = useAuth();
  const location = useLocation();

  if (!user) return <Navigate to={ROUTES.login} replace state={{ from: location }} />;
  return <Outlet />;
}
