import { useId } from "react";
import FieldError from "./FieldError.jsx";

// Text field: bold label above, optional muted hint and API errors below. `multiline` makes it a text box.
// Extra props go to the <input> or <textarea>.
export default function TextField({ label, hint, errors, multiline = false, ...inputProps }) {
  const id = useId();
  const hintId = hint ? `${id}-hint` : undefined;
  const Input = multiline ? "textarea" : "input";
  return (
    <div className="field">
      <label htmlFor={id}>{label}</label>
      <Input id={id} aria-describedby={hintId} aria-invalid={errors?.length ? true : undefined} {...inputProps} />
      {hint && (
        <small id={hintId} className="hint">
          {hint}
        </small>
      )}
      <FieldError messages={errors} />
    </div>
  );
}
