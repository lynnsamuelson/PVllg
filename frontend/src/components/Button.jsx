import { Link } from "react-router-dom";

// The design's buttons: primary (green, one per screen), outline (the second choice), small for either
// style at content width. Renders a <Link> when given `to`, otherwise a <button>.
export default function Button({ variant = "primary", small = false, to, type = "button", className = "", ...rest }) {
  const classes = `btn btn-${variant}${small ? " btn-small" : ""}${className ? ` ${className}` : ""}`;
  if (to) return <Link to={to} className={classes} {...rest} />;
  return <button type={type} className={classes} {...rest} />;
}
