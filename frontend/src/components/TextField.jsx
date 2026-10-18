import { useId } from "react";
import FieldError from "./FieldError.jsx";

// Text field: bold label above, optional muted hint and API errors below. Extra props go to the <input>.
export default function TextField({ label, hint, errors, ...inputProps }) {
  const id = useId();
  const hintId = hint ? `${id}-hint` : undefined;
  return (
    <div className="field">
      <label htmlFor={id}>{label}</label>
      <input id={id} aria-describedby={hintId} aria-invalid={errors?.length ? true : undefined} {...inputProps} />
      {hint && (
        <small id={hintId} className="hint">
          {hint}
        </small>
      )}
      <FieldError messages={errors} />
    </div>
  );
}
