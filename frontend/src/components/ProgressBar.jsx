// "STEP n OF total" (plus "· title" when given) over a green bar on a line-color track.
export default function ProgressBar({ step, total, title }) {
  const label = `Step ${step} of ${total}${title ? ` · ${title}` : ""}`;
  return (
    <div className="progress">
      <p className="progress-label">{label}</p>
      <div className="progress-track" role="progressbar" aria-label={label} aria-valuenow={step} aria-valuemin={1} aria-valuemax={total}>
        <div className="progress-fill" style={{ width: `${(step / total) * 100}%` }} />
      </div>
    </div>
  );
}
