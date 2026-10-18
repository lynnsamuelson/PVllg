import Logo from "./Logo.jsx";

// Small leaf mark with the screen's title beside it, top left (Mock Ups 9, 10, 21).
export default function AppHeader({ children }) {
  return (
    <header className="app-header">
      <Logo size={25} />
      <h1>{children}</h1>
    </header>
  );
}
