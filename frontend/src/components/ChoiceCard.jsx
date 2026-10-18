// One selectable card in a group where only one can be picked. Wrap the group in role="radiogroup".
export default function ChoiceCard({ title, description, selected, onSelect }) {
  return (
    <button
      type="button"
      role="radio"
      aria-checked={selected}
      className={`card choice-card${selected ? " selected" : ""}`}
      onClick={onSelect}
    >
      <span className="choice-card-title">{title}</span>
      <span className="choice-card-text">{description}</span>
    </button>
  );
}
