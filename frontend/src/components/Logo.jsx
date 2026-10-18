// PVill mark: peach arch over two leaves (Mock Up 1).
export default function Logo({ size = 96 }) {
  return (
    <svg className="logo" width={size} height={size} viewBox="0 0 100 100" aria-hidden="true">
      <path d="M12 72 A38 38 0 1 1 88 72" fill="none" stroke="var(--color-peach)" strokeWidth="5" strokeLinecap="round" />
      <path d="M50 90 C30 80 20 55 24 30 C40 38 52 60 50 90 Z" fill="var(--color-green)" />
      <path d="M50 90 C70 80 80 55 76 30 C60 38 48 60 50 90 Z" fill="var(--color-sage)" />
    </svg>
  );
}
