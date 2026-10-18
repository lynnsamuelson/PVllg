import { useRef } from "react";

const LENGTH = 6;

// Six one-digit boxes for an emailed code. `value` is the digits entered so far, with no gaps. Typing moves
// forward, Backspace removes one digit, and pasting (or the phone's code autofill) fills every box.
export default function CodeInput({ value, onChange, invalid, disabled }) {
  const boxes = useRef([]);
  const focus = (i) => boxes.current[Math.max(0, Math.min(i, LENGTH - 1))]?.focus();

  const fill = (digits) => {
    const next = digits.replace(/\D/g, "").slice(0, LENGTH);
    onChange(next);
    focus(next.length);
  };

  const put = (i, digit) => {
    const at = Math.min(i, value.length); // no gaps: a later box continues from the first empty one
    onChange((value.slice(0, at) + digit + value.slice(at + 1)).slice(0, LENGTH));
    focus(at + 1);
  };

  // Phones and autofill change the box without a usable key event.
  const onType = (i, typed) => {
    const clean = typed.replace(/\D/g, "");
    if (!clean) return;
    if (clean.length > 2) return fill(clean); // autofill puts the whole code in one box
    // Typing into a filled box gives two digits, the old one on whichever side the caret was; keep the new one.
    put(i, clean.length > 1 && clean[0] === value[Math.min(i, value.length)] ? clean[1] : clean[0]);
  };

  // Handled on keydown because retyping the digit already in a box doesn't fire onChange.
  const onKeyDown = (i, e) => {
    if (/^\d$/.test(e.key)) {
      e.preventDefault();
      put(i, e.key);
      return;
    }
    if (e.key !== "Backspace") return;
    e.preventDefault();
    const at = i < value.length ? i : value.length - 1;
    if (at < 0) return;
    onChange(value.slice(0, at) + value.slice(at + 1)); // later digits move back one box, so there's never a gap
    focus(at);
  };

  return (
    <div className="code-input" role="group" aria-label="6-digit code">
      {Array.from({ length: LENGTH }, (_, i) => (
        <input
          key={i}
          ref={(el) => (boxes.current[i] = el)}
          aria-label={`Digit ${i + 1}`}
          aria-invalid={invalid || undefined}
          inputMode="numeric"
          autoComplete={i === 0 ? "one-time-code" : "off"}
          disabled={disabled}
          value={value[i] ?? ""}
          onFocus={(e) => e.target.select()}
          onChange={(e) => onType(i, e.target.value)}
          onPaste={(e) => {
            e.preventDefault();
            fill(e.clipboardData.getData("text"));
          }}
          onKeyDown={(e) => onKeyDown(i, e)}
        />
      ))}
    </div>
  );
}
