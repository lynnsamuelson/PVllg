import { useLocation, useNavigate } from "react-router-dom";

// "← Results" on a details screen. Goes back (keeping the search, chips and distance) when a list opened the page
// with state { fromList: true }; otherwise, e.g. from a shared link, goes to `fallback`.
export default function BackToResults({ fallback }) {
  const navigate = useNavigate();
  const location = useLocation();
  return (
    <button
      type="button"
      className="back-link"
      onClick={() => (location.state?.fromList ? navigate(-1) : navigate(fallback))}
    >
      ← Results
    </button>
  );
}
