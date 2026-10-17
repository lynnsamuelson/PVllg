// Shows the API's validation messages for one form field (from ApiError.fields).
export default function FieldError({ messages }) {
  if (!messages?.length) return null;
  return (
    <ul className="field-error">
      {messages.map((m) => (
        <li key={m}>{m}</li>
      ))}
    </ul>
  );
}
