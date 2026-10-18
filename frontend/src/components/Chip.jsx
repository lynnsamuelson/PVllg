// Pill choice in a group where only one can be picked. Wrap the group in role="radiogroup".
export default function Chip({ children, selected, onSelect }) {
  return (
    <button type="button" role="radio" aria-checked={selected} className={`chip${selected ? " selected" : ""}`} onClick={onSelect}>
      {children}
    </button>
  );
}
