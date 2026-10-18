import symbol from "../assets/pvill-symbol.png";

// PVill mark: peach arch over two leaves (Mock Up 1). Decorative; "PVill" is always written next to it.
export default function Logo({ size = 96 }) {
  return <img className="logo" src={symbol} width={size} height={size} alt="" />;
}
