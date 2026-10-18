// Checkbox row: green filled box with a white check when on. `children` sit after the label (e.g. an info button).
export default function Checkbox({ label, checked, onChange, children }) {
  return (
    <div className="checkbox-row">
      <label>
        <input type="checkbox" checked={checked} onChange={(e) => onChange(e.target.checked)} />
        {label}
      </label>
      {children}
    </div>
  );
}
