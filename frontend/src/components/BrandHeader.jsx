import Logo from "./Logo.jsx";

// Leaf mark with "PVill" under it, centered at the top of most screens (84px in Figma).
export default function BrandHeader() {
  return (
    <div className="brand-header">
      <Logo size={65} />
      <p className="brand-header-name">PVill</p>
    </div>
  );
}
