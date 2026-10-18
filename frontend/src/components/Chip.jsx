// Pill choice. In a one-pick group wrap the chips in role="radiogroup"; with `multiple`, in role="group".
export default function Chip({ children, selected, onSelect, multiple = false }) {
  return (
    <button
      type="button"
      role={multiple ? "checkbox" : "radio"}
      aria-checked={selected}
      className={`chip${selected ? " selected" : ""}`}
      onClick={onSelect}
    >
      {children}
    </button>
  );
}
