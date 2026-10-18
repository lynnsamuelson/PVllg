import { useEffect, useId, useRef } from "react";

// Bottom sheet (AGENTS.md): white, rounded top with a peach edge, the page behind fades and stops scrolling. Used by
// Report a problem (Mock Up 24) and the Reach out demo (Mock Up 23). Escape, the backdrop or Close shuts it; the page
// underneath stays as it was. `badge` (e.g. a Demo only badge) shows above the title.
export default function BottomSheet({ title, onClose, badge, children }) {
  const sheet = useRef(null);
  const titleId = useId();
  const badgeId = useId();
  const pressedBackdrop = useRef(false);
  const close = useRef(onClose);
  close.current = onClose;

  // Once when it opens: focus the sheet, listen for Escape, and give focus back to the opener when it closes.
  useEffect(() => {
    const opener = document.activeElement;
    const scroll = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    sheet.current?.focus();
    const onKey = (e) => {
      if (e.key === "Escape") close.current();
      if (e.key !== "Tab" || !sheet.current) return;
      // Keep Tab inside the sheet while it's open.
      const focusable = sheet.current.querySelectorAll("button, [href], input, textarea, select");
      const first = focusable[0];
      const last = focusable[focusable.length - 1];
      if (e.shiftKey && document.activeElement === first) {
        e.preventDefault();
        last.focus();
      } else if (!e.shiftKey && document.activeElement === last) {
        e.preventDefault();
        first.focus();
      }
    };
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("keydown", onKey);
      document.body.style.overflow = scroll;
      opener?.focus?.();
    };
  }, []);

  return (
    // Close only for a press that starts and ends on the backdrop, not a drag that ends there.
    <div
      className="sheet-backdrop"
      onMouseDown={(e) => (pressedBackdrop.current = e.target === e.currentTarget)}
      onClick={(e) => pressedBackdrop.current && e.target === e.currentTarget && onClose()}
    >
      <div ref={sheet} className="sheet" role="dialog" aria-modal="true" aria-labelledby={titleId}
        aria-describedby={badge ? badgeId : undefined} tabIndex={-1}>
        <button type="button" className="text-link sheet-close" onClick={onClose}>
          Close
        </button>
        {badge && (
          <div id={badgeId} className="sheet-badge">
            {badge}
          </div>
        )}
        <h2 id={titleId}>{title}</h2>
        {children}
      </div>
    </div>
  );
}
