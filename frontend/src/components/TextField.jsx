import { useId } from "react";
import FieldError from "./FieldError.jsx";

// Text field: bold label above, optional muted hint and API errors below. `multiline` makes it a text box;
// `options` ([{ value, label }]) makes it a dropdown. Extra props go to the <input>, <textarea> or <select>.
export default function TextField({ label, hint, errors, multiline = false, options, placeholder, ...inputProps }) {
  const id = useId();
  const hintId = hint ? `${id}-hint` : undefined;
  const shared = { id, "aria-describedby": hintId, "aria-invalid": errors?.length ? true : undefined, ...inputProps };
  let input;
  if (options) {
    input = (
      <select {...shared}>
        <option value="">{placeholder || "Choose one"}</option>
        {options.map((o) => (
          <option key={o.value} value={o.value}>
            {o.label}
          </option>
        ))}
      </select>
    );
  } else if (multiline) {
    input = <textarea placeholder={placeholder} {...shared} />;
  } else {
    input = <input placeholder={placeholder} {...shared} />;
  }
  return (
    <div className="field">
      <label htmlFor={id}>{label}</label>
      {input}
      {hint && (
        <small id={hintId} className="hint">
          {hint}
        </small>
      )}
      <FieldError messages={errors} />
    </div>
  );
}
